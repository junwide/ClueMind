// src/hooks/useAppEvents.ts
import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { EventMap, EventNames } from '../types/events';

type EventCallback<T> = (payload: T) => void;

/**
 * 监听单个 Tauri 事件的 hook
 */
export function useTauriEvent<K extends keyof EventMap>(
  eventName: K,
  callback: EventCallback<EventMap[K]>
): void {
  // Use ref to avoid re-subscribing on callback changes
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      console.log(`[Events] Setting up listener for: ${eventName}`);
      unlisten = await listen<EventMap[K]>(eventName, (event) => {
        console.log(`[Events] Received event: ${eventName}`, event.payload);
        callbackRef.current(event.payload);
      });
      console.log(`[Events] Listener registered for: ${eventName}`);
    };

    setupListener().catch((err) => {
      console.error(`[Events] Failed to setup listener for ${eventName}:`, err);
    });

    return () => {
      if (unlisten) {
        console.log(`[Events] Cleaning up listener for: ${eventName}`);
        unlisten();
      }
    };
  }, [eventName]);
}

/**
 * 监听多个 Tauri 事件的 hook
 */
export function useAppEvents(
  callbacks: Partial<{ [K in keyof EventMap]: EventCallback<EventMap[K]> }>
): void {
  // Use ref to store callbacks to avoid re-subscribing
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Get stable list of event names
  const eventNames = Object.keys(callbacks) as (keyof EventMap)[];

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      console.log('[Events] Setting up listeners for:', eventNames);
      for (const eventName of eventNames) {
        const unlisten = await listen(eventName, (event) => {
          console.log(`[Events] Received event: ${eventName}`, event.payload);
          const callback = callbacksRef.current[eventName];
          if (callback) {
            (callback as EventCallback<unknown>)(event.payload);
          }
        });
        unlisteners.push(unlisten);
      }
      console.log('[Events] All listeners registered');
    };

    setupListeners().catch((err) => {
      console.error('[Events] Failed to setup listeners:', err);
    });

    return () => {
      console.log('[Events] Cleaning up all listeners');
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [eventNames.join(',')]); // Stable dependency based on event names
}

// 导出事件名称常量方便使用
export { EventNames };
