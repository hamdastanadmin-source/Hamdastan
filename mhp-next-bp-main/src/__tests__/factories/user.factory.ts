import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';

faker.seed(42);

export const userFactory = Factory.define<{
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: 'ADMIN' | 'ANALYST';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>(({ sequence }) => ({
  id: `user-${sequence}`,
  username: faker.internet.username().toLowerCase(),
  passwordHash: faker.string.alphanumeric(60),
  fullName: faker.person.fullName(),
  role: 'ANALYST',
  isActive: true,
  lastLoginAt: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
}));
