import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as readline from 'readline';

export class CLIInterface {
  private spinner: Ora;

  constructor() {
    this.spinner = ora();
  }

  // Display welcome message
  displayWelcome(): void {
    console.log(
      chalk.bold.hex('#CD6F47')(`
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║█████╗  
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║██╔══╝  
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
`)
    );
    console.log(
      chalk.gray('AI-powered coding assistant with MCP tool support')
    );
    console.log(chalk.gray("Type your questions or '/exit' to quit\n"));
  }

  async promptUser(): Promise<string> {
    // Stop any running spinner before prompting
    this.spinner.stop();

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(chalk.cyan('You: '), (answer: string) => {
        rl.close();
        const input = answer.trim();
        if (input.length === 0) {
          console.log(chalk.red('Please enter a message'));
          resolve(this.promptUser());
        } else {
          resolve(input);
        }
      });
    });
  }

  // Display thinking indicator
  displayThinking(): void {
    this.spinner.start(chalk.yellow('Claude is thinking...'));
  }

  // Stop thinking indicator
  stopThinking(): void {
    this.spinner.stop();
  }

  // Display AI response
  displayResponse(message: string): void {
    console.log(chalk.hex('#CD6F47')('Claude:'), message);
    console.log(); // Empty line for spacing
  }

  // Display tool execution status
  displayToolExecution(
    toolName: string,
    status: 'start' | 'success' | 'error'
  ): void {
    const icons = {
      start: '→',
      success: '✓',
      error: '✗',
    };

    const colors = {
      start: chalk.hex('#CD6F47'),
      success: chalk.hex('#CD6F47'),
      error: chalk.red,
    };

    const messages = {
      start: `Executing ${toolName}...`,
      success: `Completed ${toolName}`,
      error: `Failed ${toolName}`,
    };

    console.log(colors[status](`${icons[status]} ${messages[status]}`));
  }

  // Display tool call (when AI decides to use a tool)
  displayToolCall(toolName: string, args: any): void {
    const argsStr = typeof args === 'object' 
      ? JSON.stringify(args, null, 2).substring(0, 200) + (JSON.stringify(args).length > 200 ? '...' : '')
      : String(args).substring(0, 200);
    
    console.log(
      chalk.hex('#CD6F47')('🔧 Tool Call:') + 
      chalk.cyan(` ${toolName}`) +
      chalk.gray(`\n   Args: ${argsStr}`)
    );
  }

  // Display tool result (when tool execution completes)
  displayToolResult(toolName: string, result: any, isError: boolean = false): void {
    const resultStr = typeof result === 'string'
      ? result.substring(0, 300) + (result.length > 300 ? '...' : '')
      : typeof result === 'object'
      ? JSON.stringify(result, null, 2).substring(0, 300) + (JSON.stringify(result).length > 300 ? '...' : '')
      : String(result).substring(0, 300);
    
    const icon = isError ? '✗' : '✓';
    const color = isError ? chalk.red : chalk.green;
    
    console.log(
      color(`${icon} Tool Result:`) +
      chalk.cyan(` ${toolName}`) +
      chalk.gray(`\n   ${resultStr}`)
    );
  }

  // Display available commands
  displayHelp(): void {
    console.log(chalk.bold('\nAvailable commands:'));
    console.log(chalk.cyan('  /help') + '  - Show this help message');
    console.log(chalk.cyan('  /tools') + ' - List available tools');
    console.log(chalk.cyan('  /exit') + '  - Exit the application');
    console.log();
  }
  // Display available tools
  displayTools(tools: any[]): void {
    if (tools.length === 0) {
      console.log(chalk.yellow('No tools available'));
      return;
    }

    console.log(chalk.bold('\nAvailable tools:'));
    tools.forEach((tool, index) => {
      console.log(
        chalk.cyan(`${index + 1}. ${tool.name}`) +
          chalk.gray(` - ${tool.description || 'No description'}`)
      );
    });
    console.log();
  }

  // Display error message
  displayError(message: string): void {
    console.log(chalk.red(`Error: ${message}`));
  }

  // Display success message
  displaySuccess(message: string): void {
    console.log(chalk.hex('#CD6F47')(`${message}`));
  }
  // Display info message
  displayInfo(message: string): void {
    console.log(chalk.hex('#CD6F47')(`${message}`));
  }

  // Clear the console
  clear(): void {
    console.clear();
  }
}
