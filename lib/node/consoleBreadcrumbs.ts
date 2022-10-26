// Reference: https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/integrations/console.ts

import type {EventProcessor, Hub, Integration} from '@sentry/types';
import {fill, severityLevelFromString} from '@sentry/utils';
import util from 'util';

/** Send Console API calls as breadcrumbs */
export class ConsoleBreadcrumbs implements Integration {
  /**
   * @inheritDoc
   */
  public static readonly id = 'ConsoleBreadcrumbs';

  /**
   * @inheritDoc
   */
  public readonly name = ConsoleBreadcrumbs.id;

  /**
   * Levels to intercept
   */
  readonly #levels: readonly string[] = ['debug', 'info', 'warn', 'error', 'log'];

  /**
   * @inheritDoc
   */
  public constructor (options: Readonly<{levels?: Readonly<string[]>}> = {}) {
    if (options.levels instanceof Array) {
      this.#levels = options.levels;
    }
  }

  /**
   * @inheritDoc
   */
  public setupOnce (_: (callback: EventProcessor) => void, getCurrentHub: () => Hub): void {
    for (const level of this.#levels) {
      fill(globalThis.console, level, (originalConsoleMethod: () => unknown) => (...args: unknown[]): void => {
        const hub = getCurrentHub();

        if (hub.getIntegration(ConsoleBreadcrumbs)) {
          const sentryLevel = severityLevelFromString(level);

          hub.addBreadcrumb(
            {
              category: 'console',
              level: sentryLevel,
              message: util.format.apply(undefined, args)
            },
            {
              input: [...args],
              level
            }
          );
        }

        // eslint-disable-next-line @typescript-eslint/ban-types
        (originalConsoleMethod.apply as Function)(globalThis.console, args);
      });
    }
  }
}
