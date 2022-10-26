import {CONSOLE_LEVELS, fill, safeJoin, severityLevelFromString} from '@sentry/utils';
import type {EventProcessor, Hub, Integration} from '@sentry/types';

/** Send Console API calls as Sentry Events */
export class CaptureConsole implements Integration {
  /**
   * @inheritDoc
   */
  static id = 'CaptureConsole';

  /**
   * @inheritDoc
   */
  name = CaptureConsole.id;

  /**
   * Levels to intercept
   */
  private readonly levels: readonly string[] = CONSOLE_LEVELS;

  /**
   * @inheritDoc
   */
  public constructor (options: {levels?: string[]} = {}) {
    if (options.levels instanceof Array) {
      this.levels = options.levels;
    }
  }

  /**
   * @inheritDoc
   */
  public setupOnce (_: (callback: EventProcessor) => void, getCurrentHub: () => Hub): void {
    if (!('console' in globalThis)) {
      return;
    }

    this.levels.forEach((level: string) => {
      if (!(level in globalThis.console)) {
        return;
      }

      fill(globalThis.console, level, (originalConsoleMethod: () => unknown) => (...args: unknown[]): void => {
        const hub = getCurrentHub();

        if (hub.getIntegration(CaptureConsole)) {
          hub.withScope((scope) => {
            scope.setLevel(severityLevelFromString(level));
            scope.setExtra('arguments', args);
            scope.addEventProcessor((event) => {
              event.logger = 'console';
              return event;
            });

            let message = safeJoin(args, ' ');
            if (level === 'assert') {
              if (args[0] === false) {
                message = `Assertion failed: ${safeJoin(args.slice(1), ' ') || 'console.assert'}`;
                scope.setExtra('arguments', args.slice(1));
                hub.captureMessage(message);
              }
            } else if (['error', 'warn'].includes(level) && args[0] instanceof Error) {
              hub.captureException(args[0]);
            } else {
              hub.captureMessage(message);
            }
          });
        }

        // this fails for some browsers. :(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (originalConsoleMethod) {
          // eslint-disable-next-line @typescript-eslint/ban-types
          (originalConsoleMethod.apply as Function)(global.console, args);
        }
      });
    });
  }
}
