import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface ChatEntity {
  type: string;
  id: string;
  data: any;
}

export interface ChatContextType {
  currentPage: string;
  currentEntity?: ChatEntity;
  setContext: (ctx: Partial<Omit<ChatContextType, 'setContext'>>) => void;
  registerEntity: (entity: ChatEntity | undefined) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<string>("/");
  const [currentEntity, setCurrentEntity] = useState<ChatEntity | undefined>(undefined);

  const setContext = useCallback((ctx: Partial<Omit<ChatContextType, 'setContext'>>) => {
    if (ctx.currentPage !== undefined) {
      setCurrentPage(ctx.currentPage);
    }
    if (ctx.currentEntity !== undefined) {
      setCurrentEntity(ctx.currentEntity);
    }
  }, []);

  const registerEntity = useCallback((entity: ChatEntity | undefined) => {
    setCurrentEntity(entity);
  }, []);

  return (
    <ChatContext.Provider value={{ currentPage, currentEntity, setContext, registerEntity }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatContextProvider");
  }
  return context;
}

export function useRegisterChatContext(page: string, entity?: ChatEntity) {
  const { setContext } = useChatContext();
  
  useState(() => {
    setContext({ currentPage: page, currentEntity: entity });
  });
}
