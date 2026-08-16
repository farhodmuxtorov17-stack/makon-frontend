import { HttpException, HttpStatus } from '@nestjs/common'

/** So‘rovlar chastotasi cheklovi: kodni qayta yuborish va urinishlar soni. */
export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super({ message, reason: 'TOO_MANY_REQUESTS' }, HttpStatus.TOO_MANY_REQUESTS)
  }
}
