import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { UsersService } from './users.service'
import { CurrentUser, RequireCapability, Roles } from '../../common/decorators'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserQueryDto } from './dto/user.dto'

@ApiTags('Foydalanuvchilar')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({ summary: 'Foydalanuvchilar ro‘yxati' })
  list(@Query() query: UserQueryDto) {
    return this.users.list(query)
  }

  @Get('roles')
  @Roles(Role.SUPER_HEAD)
  @ApiOperation({ summary: 'Rollar va ularning huquqlari' })
  roles() {
    return this.users.roles()
  }

  @Get(':id')
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({ summary: 'Bitta foydalanuvchi' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id)
  }

  @Post()
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({
    summary: 'Xodim hisobini yaratish',
    description: 'Rol hisobga biriktiriladi, foydalanuvchi uni o‘zi tanlay olmaydi.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto)
  }

  @Patch(':id')
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({ summary: 'Hisob ma’lumotlari va ko‘rish sohasini yangilash' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto)
  }

  @Post(':id/password')
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({ summary: 'Parolni tiklash va ochiq sessiyalarni yopish' })
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(user, id, dto)
  }

  @Delete(':id')
  @Roles(Role.SUPER_HEAD)
  @RequireCapability('system.administer')
  @ApiOperation({
    summary: 'Hisobni faolsizlantirish',
    description: 'Yozuv o‘chirilmaydi, hisob faolsiz holatga o‘tadi.',
  })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.users.deactivate(user, id)
  }
}
