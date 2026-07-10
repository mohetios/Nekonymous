/** Workers AI embedding model for profile vectors (1024 dims, multilingual). */
export const PROFILE_EMBEDDING_MODEL = "@cf/baai/bge-m3";

export const PROFILE_EMBEDDING_DIMENSION = 1024;

export const ASSESSMENT_CALLBACK = {
  answer: (index: number, value: number) => `t:a:${index}:${value}`,
  previous: "t:p",
  exit: "t:exit",
  start: "t:start",
  continue: "t:continue",
  result: "t:result",
  reset: "t:reset",
  resetYes: "t:reset_yes",
  resetNo: "t:reset_no",
  menu: "t:menu",
  backToHub: "t:hub",
} as const;
