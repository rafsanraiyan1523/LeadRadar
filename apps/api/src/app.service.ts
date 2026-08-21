import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceInfo() {
    return {
      service: 'LeadRadar API',
      status: 'running',
      health: '/health',
    };
  }
}
