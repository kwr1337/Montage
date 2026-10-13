import { createContext } from 'react';

/** Обработчик выхода из App: шапка берёт его отсюда, чтобы экранам не приходилось прокидывать onLogout */
export const LogoutContext = createContext<(() => void | Promise<void>) | undefined>(undefined);
