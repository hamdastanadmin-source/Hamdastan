import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';

faker.seed(42);

export const sessionFactory = Factory.define<{
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}>(({ sequence }) => ({
  id: `session-${sequence}`,
  userId: `user-1`,
  token: faker.string.alphanumeric(64),
  expiresAt: faker.date.future(),
  createdAt: faker.date.recent(),
}));
