// ================================================================
// React type declarations (upgraded v3 — @types/react-compatible shape)
//
// Replaces the minimal shim that caused ~134 TypeScript errors.
// Uses the same `declare namespace React` + `export = React` pattern
// as the official @types/react, so BOTH styles work:
//   - import React from 'react'          (default import, needs esModuleInterop)
//   - import { useState } from 'react'   (named import)
//   - React.FC / React.ChangeEvent etc. in type positions
//
// Key upgrades over the old shim:
//  - useState supports the functional updater form: setX(prev => ...)
//  - useRef overloads (nullable vs non-nullable)
//  - useCallback / useMemo / useContext / useReducer / useId
//  - StrictMode, Fragment, Suspense, lazy, createContext, forwardRef, memo
//  - Full event types: FormEvent, MouseEvent, FocusEvent, ClipboardEvent,
//    KeyboardEvent, WheelEvent, TouchEvent, DragEvent, UIEvent
//  - Typed JSX DOM event handlers (fixes "implicit any" on e => ...)
// ================================================================

declare namespace React {
  // ── Core types ────────────────────────────────────────────────────────
  type ReactNode = any;
  type ReactElement = any;
  type ReactPortal = any;
  type Key = string | number;
  type ComponentType<P = {}> = FC<P>;
  type ComponentClass<P = {}> = any;
  type CSSProperties = Record<string, any>;
  type ReactText = string | number;
  type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  type ComponentProps<T = any> = any;
  type ComponentPropsWithoutRef<T = any> = any;
  type ComponentPropsWithRef<T = any> = any;
  type ElementType<P = any> = any;
  type JSXElementConstructor<P = any> = any;
  type ForwardRefExoticComponent<P = any> = any;
  type NamedExoticComponent<P = any> = any;
  type Provider<T = any> = any;
  type Consumer<T = any> = any;
  type Context<T = any> = any;
  type MutableRefObject<T> = { current: T };
  type RefObject<T> = { current: T | null };
  type Ref<T = any> = RefObject<T> | ((instance: T | null) => void) | null;
  type LegacyRef<T = any> = Ref<T>;
  type Dispatch<A = any> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);

  // ── Hooks ─────────────────────────────────────────────────────────────
  // Functional updater form supported (root-cause fix for most errors)
  function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useLayoutEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useInsertionEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useRef<T>(initialValue: T): MutableRefObject<T>;
  function useRef<T>(initialValue?: T | null): MutableRefObject<T | null>;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T;
  function useMemo<T>(factory: () => T, deps?: any[]): T;
  function useContext<T = any>(context: T): any;
  function useReducer(
    reducer: (state: any, action: any) => any,
    initialState?: any,
    init?: (state: any) => any
  ): [any, Dispatch<any>];
  function useId(): string;
  function useImperativeHandle(ref: any, init: () => any, deps?: any[]): void;
  function useDebugValue(value: any, format?: (v: any) => any): void;
  function useSyncExternalStore(subscribe: any, getSnapshot: any, getServerSnapshot?: any): any;
  function useTransition(): [boolean, (callback: () => void) => void];
  function useDeferredValue<T>(value: T): T;

  // ── Component types ───────────────────────────────────────────────────
  type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactNode;
  type FunctionComponent<P = {}> = FC<P>;
  type VoidFunctionComponent<P = {}> = FC<P>;

  class Component<P = {}, S = any> {
    constructor(props: P);
    props: P;
    state: S;
    setState(state: Partial<S> | ((prev: S, props: P) => Partial<S>), callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
  }
  class PureComponent<P = {}, S = any> extends Component<P, S> {}

  // ── Element creation / utilities ─────────────────────────────────────
  function createElement(type: any, props?: any, ...children: any[]): any;
  function cloneElement(element: any, props?: any, ...children: any[]): any;
  function createFactory(type: any): any;
  function createContext<T = any>(defaultValue?: T): Context<T>;
  function forwardRef<T = any, P = {}>(render: (props: P, ref: Ref<T>) => any): any;
  function memo<P = {}>(component: FC<P>, compare?: (prev: P, next: P) => boolean): FC<P>;
  function lazy(factory: () => Promise<any>): any;
  function isValidElement(object: any): boolean;
  function startTransition(callback: () => void): void;

  const Fragment: any;
  const StrictMode: any;
  const Suspense: any;
  const Profiler: any;
  const Children: any;
  const version: string;

  // ── Events ────────────────────────────────────────────────────────────
  interface BaseSyntheticEvent<T = Element> {
    nativeEvent: any;
    currentTarget: T;
    target: any;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    timeStamp: number;
    type: string;
    preventDefault(): void;
    stopPropagation(): void;
    persist(): void;
  }
  interface SyntheticEvent<T = Element> extends BaseSyntheticEvent<T> {}
  interface ChangeEvent<T = Element> extends BaseSyntheticEvent<T> {}
  interface FormEvent<T = Element> extends BaseSyntheticEvent<T> {}
  interface FocusEvent<T = Element> extends BaseSyntheticEvent<T> {
    relatedTarget: any;
  }
  interface MouseEvent<T = Element> extends BaseSyntheticEvent<T> {
    clientX: number;
    clientY: number;
    screenX: number;
    screenY: number;
    pageX: number;
    pageY: number;
    button: number;
    buttons: number;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }
  interface KeyboardEvent<T = Element> extends BaseSyntheticEvent<T> {
    key: string;
    code: string;
    keyCode?: number;
    which?: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    repeat: boolean;
  }
  interface WheelEvent<T = Element> extends BaseSyntheticEvent<T> {
    deltaX: number;
    deltaY: number;
    deltaZ: number;
    deltaMode: number;
  }
  interface UIEvent<T = Element> extends BaseSyntheticEvent<T> {}
  interface TouchEvent<T = Element> extends BaseSyntheticEvent<T> {
    touches: any;
    targetTouches: any;
    changedTouches: any;
  }
  interface ClipboardEvent<T = Element> extends BaseSyntheticEvent<T> {
    clipboardData: any;
  }
  interface DragEvent<T = Element> extends BaseSyntheticEvent<T> {
    dataTransfer: any;
  }
  interface AnimationEvent<T = Element> extends BaseSyntheticEvent<T> {
    animationName: string;
    elapsedTime: number;
  }
  interface TransitionEvent<T = Element> extends BaseSyntheticEvent<T> {
    propertyName: string;
    elapsedTime: number;
  }
  interface PointerEvent<T = Element> extends MouseEvent<T> {
    pointerId: number;
    pressure: number;
    pointerType: string;
  }

  // ── JSX namespace (React 19 style: React.JSX) ────────────────────────
  namespace JSX {
    type Element = any;
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface DOMElementProps {
      children?: any;
      key?: string | number;
      ref?: any;
      className?: string;
      style?: any;
      id?: string;
      dangerouslySetInnerHTML?: any;

      // Typed event handlers (generic <any> so handlers accepting
      // ChangeEvent<HTMLInputElement> etc. remain assignable)
      onChange?: (event: ChangeEvent<any>) => void;
      onInput?: (event: FormEvent<any>) => void;
      onBeforeInput?: (event: FormEvent<any>) => void;
      onSubmit?: (event: FormEvent<any>) => void;
      onReset?: (event: FormEvent<any>) => void;
      onClick?: (event: MouseEvent<any>) => void;
      onDoubleClick?: (event: MouseEvent<any>) => void;
      onMouseDown?: (event: MouseEvent<any>) => void;
      onMouseUp?: (event: MouseEvent<any>) => void;
      onMouseEnter?: (event: MouseEvent<any>) => void;
      onMouseLeave?: (event: MouseEvent<any>) => void;
      onMouseMove?: (event: MouseEvent<any>) => void;
      onMouseOver?: (event: MouseEvent<any>) => void;
      onMouseOut?: (event: MouseEvent<any>) => void;
      onContextMenu?: (event: MouseEvent<any>) => void;
      onKeyDown?: (event: KeyboardEvent<any>) => void;
      onKeyUp?: (event: KeyboardEvent<any>) => void;
      onKeyPress?: (event: KeyboardEvent<any>) => void;
      onFocus?: (event: FocusEvent<any>) => void;
      onBlur?: (event: FocusEvent<any>) => void;
      onScroll?: (event: UIEvent<any>) => void;
      onWheel?: (event: WheelEvent<any>) => void;
      onTouchStart?: (event: TouchEvent<any>) => void;
      onTouchMove?: (event: TouchEvent<any>) => void;
      onTouchEnd?: (event: TouchEvent<any>) => void;
      onTouchCancel?: (event: TouchEvent<any>) => void;
      onCopy?: (event: ClipboardEvent<any>) => void;
      onCut?: (event: ClipboardEvent<any>) => void;
      onPaste?: (event: ClipboardEvent<any>) => void;
      onDrag?: (event: DragEvent<any>) => void;
      onDragStart?: (event: DragEvent<any>) => void;
      onDragEnd?: (event: DragEvent<any>) => void;
      onDragOver?: (event: DragEvent<any>) => void;
      onDrop?: (event: DragEvent<any>) => void;
      onAnimationEnd?: (event: AnimationEvent<any>) => void;
      onAnimationStart?: (event: AnimationEvent<any>) => void;
      onTransitionEnd?: (event: TransitionEvent<any>) => void;
      onLoad?: (event: SyntheticEvent<any>) => void;
      onError?: (event: SyntheticEvent<any>) => void;

      // Allow any other HTML/SVG attribute
      [attr: string]: any;
    }
    interface IntrinsicElements {
      [elemName: string]: DOMElementProps;
    }
  }
}

// ── Module bindings ───────────────────────────────────────────────────
declare module 'react' {
  export = React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
  export namespace JSX {
    type Element = any;
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      [elemName: string]: React.JSX.DOMElementProps;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  export function jsxDEV(type: any, props: any, key?: any, isStatic?: boolean, source?: any, self?: any): any;
  export const Fragment: any;
}

declare namespace ReactDOM {
  function render(node: any, container: any, callback?: () => void): void;
  function createRoot(container: any): { render(node: any): void; unmount(): void };
  function unmountComponentAtNode(container: any): boolean;
  function flushSync<T>(callback: () => T): T;
  const createPortal: any;
}

declare module 'react-dom' {
  export = ReactDOM;
}

declare module 'react-dom/client' {
  export function createRoot(container: any): { render(node: any): void; unmount(): void };
  export function hydrateRoot(container: any, initialChildren: any): any;
}

// Global JSX fallback (classic-transform / editor compatibility)
declare namespace JSX {
  type Element = any;
  interface IntrinsicAttributes {
    key?: string | number;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicElements {
    [elemName: string]: React.JSX.DOMElementProps;
  }
}
