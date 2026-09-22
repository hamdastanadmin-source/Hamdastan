import { setupServer } from 'msw/node';

// Add your MSW request handlers here:
// import { handlers } from './handlers';
// export const mswServer = setupServer(...handlers);

export const mswServer = setupServer();
