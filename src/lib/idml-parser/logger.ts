// A logger that can be used to log and store messages.
// Each LogMessage can be assigned a type

export type LogMessage = {
  message: string;
  type: 'error' | 'warning' | 'info';
};

export class Logger {
  private static instance: Logger;
  constructor() {}
  private messages: LogMessage[] = [];

  log(message: string, type: 'error' | 'warning' | 'info' = 'info') {
    this.messages.push({ message, type });
  }

  getMessages() {
    return this.messages;
  }
}
