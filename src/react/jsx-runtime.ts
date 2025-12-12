// Polyfill for react/jsx-runtime for React 16 compatibility
import * as React from "react"

export function jsx(type: any, props: any, key?: any) {
  return React.createElement(type, { ...props, key })
}

export function jsxs(type: any, props: any, key?: any) {
  return React.createElement(type, { ...props, key })
}

export const Fragment = React.Fragment


