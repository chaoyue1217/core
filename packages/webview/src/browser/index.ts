import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { IWebviewService } from './types';
import { WebviewServiceImpl } from './webview.service';
export * from './types';

@Injectable()
export class WebviewModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IWebviewService,
      useClass: WebviewServiceImpl,
    },
  ];
}
