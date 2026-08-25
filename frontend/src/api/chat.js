// Stub for future Chat API
export const sendMessage = async (message, chatId) => {
  // TODO: connect to real backend
  return { id: Date.now(), text: 'Mock response', role: 'assistant' };
};

export const getChatHistory = async (chatId) => {
  // TODO: connect to real backend
  return [];
};
