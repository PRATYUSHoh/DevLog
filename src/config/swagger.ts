import swaggerJsdoc from 'swagger-jsdoc';

const options: any = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DevLog API',
      version: '2.0.0',
      description: 'Internal team knowledge base API with TypeScript & Zod validation'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js', './routes/*.js']
};

export default swaggerJsdoc(options);
