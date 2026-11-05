export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
