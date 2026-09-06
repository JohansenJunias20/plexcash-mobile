declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module 'react-native-zeroconf' {
  const Zeroconf: any;
  export default Zeroconf;
}

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
  }
}

