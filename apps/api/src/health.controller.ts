import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health(): { status: "ok"; time: string } {
    return { status: "ok", time: new Date().toISOString() };
  }
}
