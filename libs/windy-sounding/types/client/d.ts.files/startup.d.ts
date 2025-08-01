import type { RelatedHomepageArticlesResponseDto } from '@plugins/articles/articles.d';
import type { Timestamp } from '@windy/types';

export type StartupNewsType = 'hp-article' | 'whats-new';

export interface StartupItem {
  type: StartupNewsType;
}

export interface StartupResponse {
  'hp-articles'?: StartupArticleData[];
  'whats-new'?: WhatsNewData;
}

export interface StartupArticleData extends RelatedHomepageArticlesResponseDto, StartupItem {
  type: 'hp-article';
}

export interface WhatsNewData extends StartupItem {
  type: 'whats-new';
  id: string;
  title: string;
  contributors: {
    name: string;
    avatarUrl: string;
  }[];
  content: {
    new?: string;
    improved?: string;
    fixed?: string;
  };
}

/**
 * Info about articles, user has already seen
 */
export interface SeenArticle {
  /**
   * How many times the article has been seen
   * (one count is added only if the article has been seen after 12 hours from the last seen time)
   */
  count: number;

  /**
   * Marks beginning of 12h interval
   */
  seen: Timestamp;

  /**
   * Article was liked by user
   */
  liked?: boolean;
}

export interface SeenStory {
  /**
   * Timestamp when was story seen
   */
  seen: Timestamp;

  /**
   * Story was liked by user
   */
  liked?: boolean;
}
