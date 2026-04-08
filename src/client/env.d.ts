/// <reference types="vite/client" />

import 'vue';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $icon: (name: string, width?: number, height?: number, attrs?: string) => string;
  }
}
