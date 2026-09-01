import { useState, useEffect, useCallback } from 'react';

export interface VirtualKeyboardState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  bottomInset: number;
}

/**
 * Hook to track mobile virtual keyboard presence and height
 * using the standard window.visualViewport API.
 * Provides the exact pixel inset so floating toolbars and accessory bars
 * stick reliably to the top edge of the virtual keyboard.
 */
export function useKeyboardOffset(): VirtualKeyboardState {
  const [keyboardState, setKeyboardState] = useState<VirtualKeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    bottomInset: 0,
  });

  const updateKeyboardState = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Desktop viewports don't have a virtual software keyboard
    if (window.innerWidth >= 768) {
      setKeyboardState((prev) => {
        if (!prev.isKeyboardOpen && prev.bottomInset === 0) return prev;
        return { isKeyboardOpen: false, keyboardHeight: 0, bottomInset: 0 };
      });
      return;
    }

    if (window.visualViewport) {
      const vv = window.visualViewport;
      const windowHeight = window.innerHeight;
      
      // Calculate offset from layout viewport bottom to visual viewport bottom
      const currentInset = Math.max(
        0,
        Math.round(windowHeight - (vv.height + vv.offsetTop))
      );

      // On mobile browsers, virtual keyboards typically occupy >= 100px.
      // Small variations (< 60px) are usually dynamic browser URL address bar collapses.
      const isOpen = currentInset > 80;

      setKeyboardState({
        isKeyboardOpen: isOpen,
        keyboardHeight: isOpen ? currentInset : 0,
        bottomInset: currentInset,
      });
    } else {
      // Fallback for browsers without visualViewport support
      setKeyboardState({
        isKeyboardOpen: false,
        keyboardHeight: 0,
        bottomInset: 0,
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateKeyboardState);
      vv.addEventListener('scroll', updateKeyboardState);
    }
    window.addEventListener('resize', updateKeyboardState);
    window.addEventListener('orientationchange', updateKeyboardState);

    // Initial check
    updateKeyboardState();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateKeyboardState);
        vv.removeEventListener('scroll', updateKeyboardState);
      }
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('orientationchange', updateKeyboardState);
    };
  }, [updateKeyboardState]);

  return keyboardState;
}
