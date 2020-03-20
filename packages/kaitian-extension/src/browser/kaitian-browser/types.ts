import { IExtension } from '../..';
import { ProxyIdentifier } from '@ali/ide-connection/lib/common/rpcProtocol';
import { IDisposable, URI, Uri } from '@ali/ide-core-common';
import { EditorComponentRenderMode } from '@ali/ide-editor/lib/browser';
import { Path } from '@ali/ide-core-common/lib/path';
import { ToolBarPosition } from '@ali/ide-toolbar/lib/browser';

export interface IKaitianBrowserContributions {
  left?: {
    component: ITabBarComponentContribution[],
  };
  right?: {
    component: ITabBarComponentContribution[],
  };
  bottom?: {
    component: ITabBarComponentContribution[],
  };
  editor?: {
    component: IEditorComponentContribution[];
  };
  toolBar?: {
    position?: ToolBarPosition // @deprecated
    component: IToolBarComponentContribution[];
  };
}

export interface IToolBarComponentContribution {

  /**
   * id
   */
  id: string;
  /**
   * ToolBar 组件主体
   */
  panel: React.FC;

  /**
   * 位置
   */
  position: ToolBarPosition;

}

export interface ITabBarComponentContribution {

  /**
   * id
   */
  id: string;
  /**
   * Tabbar组件主体
   */
  panel: React.FC;

  /**
   * 内置icon名称
   */
  icon?: string;

  /**
   * 相对于插件路径的icon地址
   */
  iconPath?: string;

  /**
   * 用于激活的快捷键
   */
  keyBinding?: string;

  /**
   * 名称
   */
  title: string;

  /**
   * 排序权重
   */
  priority?: number;

  /**
   * 禁止面板的resize功能
   */
  noResize?: boolean;

  /**
   * 是否全部展开
   */
  expanded?: boolean;
}

export interface IEditorComponentContribution {

  /**
   * id
   */
  id: string;

  /**
   * 适配的scheme, 如果不填，默认为file协议
   */
  scheme?: string;

  /**
   * editor组件主体
   */
  panel: React.FC;

  /**
   * 渲染方式
   */
  renderMode?: EditorComponentRenderMode;

  /**
   * 仅作用于file协议
   * 要处理的文件的后缀
   */
  fileExt?: string[];

  /**
   * 仅作用于file协议
   * 判断一个path是否要被处理
   * @deprecated
   */
  shouldPreview?: (path: Path) => boolean;

  /**
   * 判断一个uri是否要被处理(传入参数为vscode uri)
   * 如果不存在handles方法，则默认显示（file协议还要过shouldPreview和fileExt)
   */
  handles?: (uri: Uri) => boolean;

  /**
   * 如果这个资源有多个打开方式，这个会作为打开方式名称
   */
  title?: string;

  /**
   * 排序权重， 默认为10
   */
  priority?: number;

  /**
   * Tab名称，如果需要更复杂的名称Resolve，需要在kaitian node进程中注册ResourceProvider
   */
  tabTitle?: string;

   /**
   * 相对于插件路径的icon地址
   * 如果需要更复杂的图标Resolve，需要在kaitian node进程中注册ResourceProvider
   */
  tabIconPath?: string;
}

export interface IRunParam {
  getExtensionExtendService: (extension: IExtension, componentId: string) => {
    extendProtocol: {
      getProxy: (identifier: ProxyIdentifier<any>) => {
      node: any,
      worker: any,
      },
      set: <T>(identifier: ProxyIdentifier<T>, service: T) => void,
    },
    extendService: any,
  };
}

export abstract class AbstractKaitianBrowserContributionRunner {

  constructor(protected extension: IExtension, protected contribution: IKaitianBrowserContributions) {}

  abstract run(param: IRunParam): IDisposable;

}
