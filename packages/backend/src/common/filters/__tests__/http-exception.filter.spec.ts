import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../http-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/test',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  });

  it('should handle HttpException with correct status and message', () => {
    const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden resource',
        path: '/api/test',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: 'Bad Request',
      }),
    );
  });

  it('should return 500 with generic message for unknown exceptions (no stack leak)', () => {
    const exception = new Error('Database connection failed - secret info');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.statusCode).toBe(500);
    expect(responseBody.message).toBe('An unexpected error occurred');
    expect(responseBody.error).toBe('Internal Server Error');
    // Must NOT leak internal details
    expect(responseBody.message).not.toContain('Database connection');
    expect(responseBody.stack).toBeUndefined();
  });

  it('should handle non-Error unknown exceptions', () => {
    filter.catch('string error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.message).toBe('An unexpected error occurred');
  });

  it('should include timestamp and path in response', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.timestamp).toBeDefined();
    expect(responseBody.path).toBe('/api/test');
    // Verify timestamp is a valid ISO string
    expect(() => new Date(responseBody.timestamp)).not.toThrow();
  });

  it('should handle validation errors (array of messages)', () => {
    const exception = new HttpException(
      {
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.message).toEqual(['email must be an email', 'password is too short']);
  });

  it('should handle 401 Unauthorized', () => {
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Unauthorized',
      }),
    );
  });
});
