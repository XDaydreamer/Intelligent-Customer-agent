export type TabId =
  | 'chat'
  | 'knowledge-new'
  | 'knowledge-upload'
  | 'knowledge-doc'
  | 'knowledge-ai'
  | 'chat-history'
  | 'cs-template'
  | 'store-config'
  | 'transfer'
  | 'copywriting';

export interface Template {
  id: string;
  name: string;
  content: string;
  intro: string;
  updatedAt: string;
}

export interface AIDialog {
  id: string;
  question: string;
  answer: string;
  shop: string;
  children?: AIDialog[];
  expanded?: boolean;
}

export interface TransferRule {
  id: string;
  keyword: string;
  reply: string;
  enabled: boolean;
}
