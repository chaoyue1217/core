import * as fuzzy from 'fuzzy';
import * as readline from 'readline';
import { rgPath } from '@ali/vscode-ripgrep';
import { Injectable, Autowired } from '@ali/common-di';
import { CancellationToken, CancellationTokenSource, Schemas } from '@ali/ide-core-common';
import { URI, FileUri } from '@ali/ide-core-node';
import { IProcessFactory } from '@ali/ide-process';
import { ILogServiceManage, SupportLogNamespace, ILogService } from '@ali/ide-logs/lib/node';
import { IFileSearchService } from '../common';

@Injectable()
export class FileSearchService implements IFileSearchService {

  @Autowired(IProcessFactory)
  processFactory: IProcessFactory;

  @Autowired(ILogServiceManage)
  loggerMange: ILogServiceManage;
  logger: ILogService = this.loggerMange.getLogger(SupportLogNamespace.Node);

  async find(searchPattern: string, options: IFileSearchService.Options, clientToken?: CancellationToken): Promise<string[]> {
    this.logger.debug('searchPattern', searchPattern);
    const cancellationSource = new CancellationTokenSource();
    if (clientToken) {
      clientToken.onCancellationRequested(() => cancellationSource.cancel());
    }
    const token = cancellationSource.token;
    const opts = {
      fuzzyMatch: true,
      limit: Number.MAX_SAFE_INTEGER,
      useGitIgnore: true,
      ...options,
    };

    const roots: IFileSearchService.RootOptions = options.rootOptions || {};
    if (options.rootUris) {
      for (const rootUri of options.rootUris) {
        if (!roots[rootUri]) {
          roots[rootUri] = {};
        }
      }
    }
    // tslint:disable-next-line:forin
    for (const rootUri in roots) {
      const rootOptions = roots[rootUri];
      if (opts.includePatterns) {
        const includePatterns = rootOptions.includePatterns || [];
        rootOptions.includePatterns = [...includePatterns, ...opts.includePatterns];
      }
      if (opts.excludePatterns) {
        const excludePatterns = rootOptions.excludePatterns || [];
        rootOptions.excludePatterns = [...excludePatterns, ...opts.excludePatterns];
      }
      if (rootOptions.useGitIgnore === undefined) {
        rootOptions.useGitIgnore = opts.useGitIgnore;
      }
      if (rootOptions.noIgnoreParent === undefined) {
        rootOptions.noIgnoreParent = opts.noIgnoreParent;
      }
    }

    const exactMatches = new Set<string>();
    const fuzzyMatches = new Set<string>();
    const stringPattern = searchPattern.toLocaleLowerCase();
    await Promise.all(Object.keys(roots).map(async (root) => {
      try {
        const rootUri = new URI(root);
        const rootOptions = roots[root];
        await this.doFind(rootUri, rootOptions, (candidate) => {
          const fileUri = rootUri.resolve(candidate).withScheme(Schemas.file).toString();
          if (exactMatches.has(fileUri) || fuzzyMatches.has(fileUri)) {
            return;
          }
          if (!searchPattern || searchPattern === '*' || candidate.toLocaleLowerCase().indexOf(stringPattern) !== -1) {
            exactMatches.add(fileUri);
          } else if (opts.fuzzyMatch && fuzzy.test(searchPattern, candidate)) {
            fuzzyMatches.add(fileUri);
          }
          if (exactMatches.size + fuzzyMatches.size === opts.limit) {
            cancellationSource.cancel();
          }
        }, token);
      } catch (e) {
        console.error('Failed to search:', root, e);
      }
    }));
    return [...exactMatches, ...fuzzyMatches];
  }

  private doFind(rootUri: URI, options: IFileSearchService.BaseOptions,
                 accept: (fileUri: string) => void, token: CancellationToken): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const cwd = FileUri.fsPath(rootUri);
        const args = this.getSearchArgs(options);
        // TODO: why not just child_process.spawn, theia process are supposed to be used for user processes like tasks and terminals, not internal
        const process = this.processFactory.create({ command: rgPath, args, options: { cwd } });
        process.onError(reject);
        process.outputStream.on('close', resolve);

        const lineReader = readline.createInterface({
          input: process.outputStream,
          output: process.inputStream,
        });
        lineReader.on('line', (line) => {
          if (token.isCancellationRequested) {
            process.dispose();
          } else {
            accept(line);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private getSearchArgs(options: IFileSearchService.BaseOptions): string[] {
    const args = ['--files', '--case-sensitive'];
    if (options.includePatterns) {
      for (const includePattern of options.includePatterns) {
        if (includePattern) {
          args.push('--glob', includePattern);
        }
      }
    }
    if (options.excludePatterns) {
      for (const excludePattern of options.excludePatterns) {
        if (excludePattern) {
          args.push('--glob', `!${excludePattern}`);
        }
      }
    }
    if (!options.useGitIgnore) {
      args.push('-uu');
    }
    if (options.noIgnoreParent) {
      args.push('--no-ignore-parent');
    }
    return args;
  }

}
