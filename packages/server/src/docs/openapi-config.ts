export const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Zainpreneur Business OS API',
    version: '1.0.0',
    description: 'REST API for Zainpreneur Business OS — manages businesses, owners, tasks, transactions, team, assets, procurement, HR, ledger, and invoicing.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
  ],
}
