const technicalAboutPath = "/about/technical";

export const technicalAboutUrl = (publicSiteUrl?: string): string | null => {
  if (!publicSiteUrl?.trim()) {
    return null;
  }

  return `${publicSiteUrl.replace(/\/$/, "")}${technicalAboutPath}`;
};
