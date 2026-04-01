use crate::error::{AppError, Result};
use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

/// Manages global keyboard shortcuts with fallback support for conflict detection.
///
/// The `ShortcutManager` provides a centralized way to register global shortcuts
/// with automatic fallback to alternative key combinations when the primary
/// shortcut is already in use by another application.
pub struct ShortcutManager {
    /// The primary/default shortcut to attempt first
    default_shortcut: Shortcut,
    /// Alternative shortcuts to try if the default fails
    fallback_shortcuts: Vec<Shortcut>,
}

impl ShortcutManager {
    /// Creates a new `ShortcutManager` with predefined default and fallback shortcuts.
    ///
    /// # Default Shortcuts
    /// - Primary: `Ctrl/Cmd + Shift + D` (Code::KeyD)
    /// - Fallback 1: `Ctrl/Cmd + Shift + N`
    /// - Fallback 2: `Ctrl/Cmd + Alt + D`
    ///
    /// # Example
    /// ```
    /// use cluemind::shortcuts::ShortcutManager;
    ///
    /// let manager = ShortcutManager::new();
    /// assert_eq!(manager.default_shortcut().key, tauri_plugin_global_shortcut::Code::KeyD);
    /// ```
    pub fn new() -> Self {
        // Platform-specific modifier: Ctrl on Linux/Windows, Cmd on macOS
        #[cfg(target_os = "macos")]
        let primary_modifier = Modifiers::SUPER;
        #[cfg(not(target_os = "macos"))]
        let primary_modifier = Modifiers::CONTROL;

        let default_shortcut = Shortcut::new(Some(primary_modifier | Modifiers::SHIFT), Code::KeyD);

        let fallback_shortcuts = vec![
            // Fallback 1: Ctrl/Cmd + Shift + N
            Shortcut::new(Some(primary_modifier | Modifiers::SHIFT), Code::KeyN),
            // Fallback 2: Ctrl/Cmd + Alt + D
            Shortcut::new(Some(primary_modifier | Modifiers::ALT), Code::KeyD),
        ];

        Self {
            default_shortcut,
            fallback_shortcuts,
        }
    }

    /// Creates a `ShortcutManager` with custom shortcuts.
    ///
    /// # Arguments
    /// * `default_shortcut` - The primary shortcut to attempt first
    /// * `fallback_shortcuts` - Alternative shortcuts to try if the default fails
    pub fn with_custom_shortcuts(
        default_shortcut: Shortcut,
        fallback_shortcuts: Vec<Shortcut>,
    ) -> Self {
        Self {
            default_shortcut,
            fallback_shortcuts,
        }
    }

    /// Attempts to register a shortcut with automatic fallback on conflict.
    ///
    /// This method first tries to register the default shortcut. If that fails
    /// (e.g., due to a conflict with another application), it automatically
    /// tries each fallback shortcut in order until one succeeds.
    ///
    /// # Arguments
    /// * `app` - The Tauri `AppHandle` for accessing the global shortcut extension
    /// * `handler` - A closure that will be called when the shortcut is triggered.
    ///   The closure receives the app handle, a reference to the triggered shortcut,
    ///   and the shortcut event.
    ///
    /// # Returns
    /// The successfully registered `Shortcut` on success, or an error if all
    /// shortcuts fail to register.
    ///
    /// # Errors
    /// Returns `AppError::Shortcut` if none of the shortcuts could be registered.
    ///
    /// # Example
    /// ```ignore
    /// use tauri::AppHandle;
    /// use cluemind::shortcuts::ShortcutManager;
    /// use tauri_plugin_global_shortcut::ShortcutState;
    ///
    /// let manager = ShortcutManager::new();
    /// let shortcut = manager.register_with_fallback(&app, |app, shortcut, event| {
    ///     if event.state == ShortcutState::Pressed {
    ///         // Handle shortcut press
    ///         println!("Shortcut triggered: {:?}", shortcut);
    ///     }
    /// })?;
    /// ```
    pub fn register_with_fallback<F, R>(
        &self,
        app: &AppHandle<R>,
        handler: F,
    ) -> Result<Shortcut>
    where
        R: Runtime,
        F: Fn(&AppHandle<R>, &Shortcut, ShortcutEvent) + Send + Sync + Clone + 'static,
    {
        let shortcut_ext = app.global_shortcut();

        // Try to register the default shortcut first
        match shortcut_ext.on_shortcut(self.default_shortcut, handler.clone()) {
            Ok(_) => {
                tracing::info!(
                    "Successfully registered default shortcut: {:?}",
                    self.default_shortcut
                );
                return Ok(self.default_shortcut);
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to register default shortcut {:?}: {}. Trying fallbacks...",
                    self.default_shortcut,
                    e
                );
            }
        }

        // Try fallback shortcuts
        for fallback in &self.fallback_shortcuts {
            match shortcut_ext.on_shortcut(*fallback, handler.clone()) {
                Ok(_) => {
                    tracing::info!(
                        "Successfully registered fallback shortcut: {:?}",
                        fallback
                    );
                    return Ok(*fallback);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to register fallback shortcut {:?}: {}. Trying next...",
                        fallback,
                        e
                    );
                }
            }
        }

        // All shortcuts failed
        Err(AppError::Shortcut(
            "Failed to register any shortcut: all shortcuts are in use".to_string(),
        ))
    }

    /// Returns a reference to the fallback shortcuts vector.
    pub fn fallback_shortcuts(&self) -> &Vec<Shortcut> {
        &self.fallback_shortcuts
    }

    /// Returns a reference to the default shortcut.
    pub fn default_shortcut(&self) -> &Shortcut {
        &self.default_shortcut
    }

    /// Checks if a specific shortcut is currently registered.
    ///
    /// # Arguments
    /// * `app` - The Tauri `AppHandle` for accessing the global shortcut extension
    /// * `shortcut` - The shortcut to check
    ///
    /// # Returns
    /// `true` if the shortcut is registered, `false` otherwise.
    pub fn is_registered<R: Runtime>(&self, app: &AppHandle<R>, shortcut: Shortcut) -> bool {
        app.global_shortcut().is_registered(shortcut)
    }

    /// Unregisters a specific shortcut.
    ///
    /// # Arguments
    /// * `app` - The Tauri `AppHandle` for accessing the global shortcut extension
    /// * `shortcut` - The shortcut to unregister
    ///
    /// # Errors
    /// Returns `AppError::Shortcut` if the shortcut could not be unregistered.
    pub fn unregister<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        shortcut: Shortcut,
    ) -> Result<()> {
        app.global_shortcut()
            .unregister(shortcut)
            .map_err(|e| AppError::Shortcut(format!("Failed to unregister shortcut: {}", e)))?;
        tracing::info!("Unregistered shortcut: {:?}", shortcut);
        Ok(())
    }

    /// Unregisters all shortcuts managed by this manager.
    ///
    /// # Arguments
    /// * `app` - The Tauri `AppHandle` for accessing the global shortcut extension
    ///
    /// # Errors
    /// Returns `AppError::Shortcut` if any shortcut could not be unregistered.
    pub fn unregister_all<R: Runtime>(&self, app: &AppHandle<R>) -> Result<()> {
        let shortcut_ext = app.global_shortcut();

        // Unregister default if registered
        if shortcut_ext.is_registered(self.default_shortcut) {
            self.unregister(app, self.default_shortcut)?;
        }

        // Unregister all fallbacks if registered
        for fallback in &self.fallback_shortcuts {
            if shortcut_ext.is_registered(*fallback) {
                self.unregister(app, *fallback)?;
            }
        }

        Ok(())
    }
}

impl Default for ShortcutManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for ShortcutManager {
    fn clone(&self) -> Self {
        Self {
            default_shortcut: self.default_shortcut,
            fallback_shortcuts: self.fallback_shortcuts.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shortcut_manager_new() {
        let manager = ShortcutManager::new();

        // Verify default shortcut uses KeyD
        assert_eq!(manager.default_shortcut().key, Code::KeyD);

        // Verify we have exactly 2 fallback shortcuts
        assert_eq!(manager.fallback_shortcuts().len(), 2);
    }

    #[test]
    fn test_default_shortcut_modifiers() {
        let manager = ShortcutManager::new();
        let shortcut = manager.default_shortcut();

        // Verify the shortcut has a key
        assert_eq!(shortcut.key, Code::KeyD);

        // Verify modifiers are set (platform-specific)
        #[cfg(target_os = "macos")]
        {
            // On macOS: SUPER (Cmd) + SHIFT
            assert!(shortcut.mods.contains(Modifiers::SUPER));
        }
        #[cfg(not(target_os = "macos"))]
        {
            // On Linux/Windows: CONTROL + SHIFT
            assert!(shortcut.mods.contains(Modifiers::CONTROL));
        }
        assert!(shortcut.mods.contains(Modifiers::SHIFT));
    }

    #[test]
    fn test_fallback_shortcuts_content() {
        let manager = ShortcutManager::new();
        let fallbacks = manager.fallback_shortcuts();

        // First fallback should be KeyN with Shift
        assert_eq!(fallbacks[0].key, Code::KeyN);
        assert!(fallbacks[0].mods.contains(Modifiers::SHIFT));

        // Second fallback should be KeyD with Alt
        assert_eq!(fallbacks[1].key, Code::KeyD);
        assert!(fallbacks[1].mods.contains(Modifiers::ALT));
    }

    #[test]
    fn test_custom_shortcuts() {
        let custom_default = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyA);
        let custom_fallbacks = vec![
            Shortcut::new(Some(Modifiers::CONTROL), Code::KeyB),
            Shortcut::new(Some(Modifiers::CONTROL), Code::KeyC),
        ];

        let manager = ShortcutManager::with_custom_shortcuts(custom_default, custom_fallbacks);

        assert_eq!(manager.default_shortcut().key, Code::KeyA);
        assert_eq!(manager.fallback_shortcuts().len(), 2);
        assert_eq!(manager.fallback_shortcuts()[0].key, Code::KeyB);
        assert_eq!(manager.fallback_shortcuts()[1].key, Code::KeyC);
    }

    #[test]
    fn test_default_trait() {
        let manager = ShortcutManager::default();
        assert_eq!(manager.default_shortcut().key, Code::KeyD);
    }

    #[test]
    fn test_clone() {
        let manager = ShortcutManager::new();
        let cloned = manager.clone();

        assert_eq!(manager.default_shortcut().key, cloned.default_shortcut().key);
        assert_eq!(
            manager.fallback_shortcuts().len(),
            cloned.fallback_shortcuts().len()
        );
    }

    #[test]
    fn test_shortcut_equality() {
        let shortcut1 = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
        let shortcut2 = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
        let shortcut3 = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyD);

        assert_eq!(shortcut1, shortcut2);
        assert_ne!(shortcut1, shortcut3);
    }

    #[test]
    fn test_empty_fallbacks() {
        let custom_default = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyX);
        let manager = ShortcutManager::with_custom_shortcuts(custom_default, vec![]);

        assert_eq!(manager.fallback_shortcuts().len(), 0);
    }
}
