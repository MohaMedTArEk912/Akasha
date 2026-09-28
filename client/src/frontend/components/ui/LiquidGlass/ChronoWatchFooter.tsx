import React from "react";
import { CodeRuntimeConsole, CodeRuntimeConsoleProps } from "./CodeRuntimeConsole";

export const ChronoWatchFooter: React.FC<CodeRuntimeConsoleProps> = (props) => {
  return <CodeRuntimeConsole {...props} />;
};

export default ChronoWatchFooter;
export * from "./CodeRuntimeConsole";
