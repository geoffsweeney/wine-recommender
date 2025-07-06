export interface MockZodType { // Add export
  parse: jest.Mock;
  safeParse: jest.Mock;
  _def: { typeName: string; isOptional?: boolean; isNullable?: boolean; hasDefault?: boolean };
  optional: jest.Mock<MockZodType>;
  nullable: jest.Mock<MockZodType>;
  default: jest.Mock<MockZodType>;
  array: jest.Mock<MockZodType>;
  min: jest.Mock<MockZodType>;
  max: jest.Mock<MockZodType>;
  positive: jest.Mock<MockZodType>;
  _mockParseImplementation?: (val: any) => any;
}

export const createMockZodType = (typeName: string): MockZodType => { // Add export
  const mockType: MockZodType = {
    parse: jest.fn((val) => {
      if (mockType._mockParseImplementation) {
        return mockType._mockParseImplementation(val);
      }
      return val; // Default behavior: return value
    }),
    safeParse: jest.fn((val) => ({ success: true, data: val })),
    _def: { typeName },
    optional: jest.fn(() => ({ ...mockType, _def: { ...mockType._def, isOptional: true, typeName: 'ZodOptional' } })),
    nullable: jest.fn(() => ({ ...mockType, _def: { ...mockType._def, isNullable: true, typeName: 'ZodNullable' } })),
    default: jest.fn(() => ({ ...mockType, _def: { ...mockType._def, hasDefault: true, typeName: 'ZodDefault' } })),
    array: jest.fn(() => ({ ...mockType, _def: { ...mockType._def, typeName: 'ZodArray' } })),
    min: jest.fn(() => mockType), // Add min method
    max: jest.fn(() => mockType), // Add max method
    positive: jest.fn(() => mockType), // Add positive method
  };
  return mockType;
};

const types = {
  ZodObject: createMockZodType('ZodObject'),
  ZodString: createMockZodType('ZodString'),
  ZodNumber: createMockZodType('ZodNumber'),
  ZodBoolean: createMockZodType('ZodBoolean'),
  ZodArray: createMockZodType('ZodArray'),
  ZodEnum: createMockZodType('ZodEnum'),
  ZodLiteral: createMockZodType('ZodLiteral'),
  ZodUnion: createMockZodType('ZodUnion'),
  ZodOptional: createMockZodType('ZodOptional'),
  ZodNullable: createMockZodType('ZodNullable'),
  ZodDefault: createMockZodType('ZodDefault'),
};

class MockZodError extends Error {
  errors: { message: string }[]; // Explicitly type errors as an array of objects with message
  constructor(issues: any[]) {
    super('ZodError');
    this.name = 'ZodError';
    this.errors = issues.map(issue => ({ message: issue.message || 'Validation Error' })); // Ensure each issue has a message
  }
}

const z = {
  object: jest.fn((shape) => ({ ...types.ZodObject, shape })),
  string: jest.fn(() => types.ZodString),
  number: jest.fn(() => types.ZodNumber),
  boolean: jest.fn(() => types.ZodBoolean),
  array: jest.fn((element) => ({ ...types.ZodArray, element })),
  enum: jest.fn((options) => ({ ...types.ZodEnum, options })),
  literal: jest.fn((value) => ({ ...types.ZodLiteral, value })),
  union: jest.fn((options) => ({ ...types.ZodUnion, options })),
  optional: jest.fn((schema) => ({ ...types.ZodOptional, innerType: schema })),
  nullable: jest.fn((schema) => ({ ...types.ZodNullable, innerType: schema })),
  default: jest.fn((schema, value) => ({ ...types.ZodDefault, innerType: schema, defaultValue: value })),
  // Add other Zod types as needed
  any: jest.fn(() => createMockZodType('ZodAny')),
  unknown: jest.fn(() => createMockZodType('ZodUnknown')),
  null: jest.fn(() => createMockZodType('ZodNull')),
  undefined: jest.fn(() => createMockZodType('ZodUndefined')),
  void: jest.fn(() => createMockZodType('ZodVoid')),
  tuple: jest.fn(() => createMockZodType('ZodTuple')),
  record: jest.fn(() => createMockZodType('ZodRecord')),
  map: jest.fn(() => createMockZodType('ZodMap')),
  set: jest.fn(() => createMockZodType('ZodSet')),
  date: jest.fn(() => createMockZodType('ZodDate')),
  bigint: jest.fn(() => createMockZodType('ZodBigInt')),
  symbol: jest.fn(() => createMockZodType('ZodSymbol')),
  function: jest.fn(() => createMockZodType('ZodFunction')),
  lazy: jest.fn(() => createMockZodType('ZodLazy')),
  promise: jest.fn(() => createMockZodType('ZodPromise')),
  ZodError: MockZodError, // Add MockZodError
};

module.exports = { z, ...types, createMockZodType }; // Add createMockZodType here
