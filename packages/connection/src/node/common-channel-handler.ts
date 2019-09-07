import {WebSocketHandler} from './ws';
import * as pathMatch from 'path-match';
import * as ws from 'ws';
import {WSChannel, ChannelMessage} from '../common/ws-channel';
const route = pathMatch();

export interface IPathHander {
  dispose: (connection: any, connectionId: string) => void;
  handler: (connection: any, connectionId: string, params?: any) => void;
  reconnect?: (connection: any, connectionId: string) => void;
  connection?: any;
}

// export const pathHandler: Map<string, ((connection: any) => void)[]> = new Map();

export class CommonChannelPathHandler {
  private handlerMap: Map<string, IPathHander[]> = new Map();
  private paramsKey: Map<string, string> = new Map();

  register(channelPath: string, handler: IPathHander) {
    const paramsIndex = channelPath.indexOf('\/:');
    const hasParams = paramsIndex >= 0;
    let channelToken = channelPath;
    if (hasParams) {
      channelToken = channelPath.slice(0, paramsIndex);
      this.paramsKey.set(channelToken, channelPath.slice(paramsIndex + 2));
    }
    if (!this.handlerMap.has(channelToken)) {
      this.handlerMap.set(channelToken, []);
    }
    const handlerArr = this.handlerMap.get(channelToken) as IPathHander[];
    const handlerFn = handler.handler.bind(handler);
    const setHandler = (connection, clientId, params) => {
      handler.connection = connection;
      handlerFn(connection, clientId, params);
    };
    handler.handler = setHandler;
    handlerArr.push(handler);
    this.handlerMap.set(channelToken, handlerArr);
  }
  getParams(channelPath: string, value: string) {
    const params = {};
    if (this.paramsKey.has(channelPath)) {
      const key = this.paramsKey.get(channelPath);
      if (key) {
        params[key] = value;
      }
    }
    return params;
  }
  removeHandler(channelPath: string, handler: IPathHander) {
    const paramsIndex = channelPath.indexOf(':');
    const hasParams = paramsIndex >= 0;
    let channelToken = channelPath;
    if (hasParams) {
      channelToken = channelPath.slice(0, paramsIndex);
    }
    const handlerArr = this.handlerMap.get(channelToken) || [];
    const removeIndex = handlerArr.indexOf(handler);
    if (removeIndex !== -1) {
      handlerArr.splice(removeIndex, 1);
    }
    this.handlerMap.set(channelPath, handlerArr);
  }
  get(channelPath: string) {
    return this.handlerMap.get(channelPath);
  }
  disposeConnectionClientId(connection: ws, clientId: string) {
    this.handlerMap.forEach((handlerArr: IPathHander[]) => {
      handlerArr.forEach((handler: IPathHander) => {
        handler.dispose(connection, clientId);
      });
    });
  }

  reconnectConnectionClientId(connection: ws, clientId: string) {

  }

  // 待废弃
  disposeAll() {
    // this.handlerMap.forEach((handlerArr: IPathHander[]) => {
    //   handlerArr.forEach((handler: IPathHander) => {
    //     handler.dispose(handler.connection);
    //   });
    // });
  }
  getAll() {
    return Array.from(this.handlerMap.values());
  }
}

export const commonChannelPathHandler = new CommonChannelPathHandler();

// 后台 Web 链接处理类
export class CommonChannelHandler extends WebSocketHandler {
  static channelId = 0;

  public handlerId = 'common-channel';
  private wsServer: ws.Server;
  private handlerRoute: (wsPathname: string) => any;
  private channelMap: Map<string | number, WSChannel> = new Map();
  private connectionMap: Map<string, ws> = new Map();
  private heartbeatMap: Map<string, NodeJS.Timeout> = new Map();

  constructor(routePath: string, private logger: any = console) {
    super();
    this.handlerRoute = route(routePath);
    this.initWSServer();
  }
  private hearbeat(connectionId: string, connection: ws) {

    const timer = setTimeout(() => {
      connection.ping();
      // console.log(`connectionId ${connectionId} ping`);
      this.hearbeat(connectionId, connection);
    }, 5000);

    this.heartbeatMap.set(connectionId, timer);
  }

  private initWSServer() {
    this.logger.log('init Common Channel Handler');
    this.wsServer = new ws.Server({noServer: true});
    this.wsServer.on('connection', (connection: ws) => {
      let connectionId;

      connection.on('message', (msg: string) => {
        let msgObj: ChannelMessage;
        try {
          msgObj = JSON.parse(msg);

          // 心跳消息
          if (msgObj.kind === 'heartbeat') {
            // console.log(`heartbeat msg ${msgObj.clientId}`)
            connection.send(JSON.stringify(`heartbeat ${msgObj.clientId}`));
          } else if (msgObj.kind === 'client') {
            const clientId = msgObj.clientId;

            /*
            // 避免内存泄露，这个 map 是需要删除掉关系的，那么则无法判断
            if (this.connectionMap.has(clientId)) {
              console.log(`connection reconnect success ${clientId}`);

              Array.from(this.channelMap.values())
                   .filter((channel) => {
                      return channel.id.toString().indexOf(clientId) !== -1;
                    })
                   .forEach((channel) => {
                      const connectionSend = this.channelConnectionSend(connection);
                      channel.setConnectionSend(connectionSend);
                   });
              //TODO: 存在 map 被清空的情况，只有前台知道有哪些 channel 要重新注册

            } else {
              */

            connectionId = clientId;
              /*
            }
            */

            this.connectionMap.set(clientId, connection);
            console.log('connectionMap', this.connectionMap.keys());

            this.hearbeat(connectionId, connection);
          // channel 消息处理
          } else if (msgObj.kind === 'open') {
            const channelId = msgObj.id; // CommonChannelHandler.channelId ++;
            const {path} = msgObj;

            // 生成 channel 对象
            const connectionSend = this.channelConnectionSend(connection);
            const channel = new WSChannel(connectionSend, channelId);
            this.channelMap.set(channelId, channel);

            // 根据 path 拿到注册的 handler
            let handlerArr = commonChannelPathHandler.get(path);
            let params;
            // 尝试通过父路径查找处理函数，如server/:id方式注册的handler
            // TODO：支持多个参数
            if (!handlerArr) {
              const slashIndex = path.indexOf('/');
              const hasSlash = slashIndex >= 0;
              if (hasSlash) {
                handlerArr = commonChannelPathHandler.get(path.slice(0, slashIndex));
                params = commonChannelPathHandler.getParams(path.slice(0, slashIndex), path.slice(slashIndex + 1));
              }
            }

            if (handlerArr) {
              for (let i = 0, len = handlerArr.length; i < len; i++) {
                const handler = handlerArr[i];
                handler.handler(channel, connectionId, params);
              }
            }

            channel.ready();
          } else {
            // console.log('connection message', msgObj.id, msgObj.kind, this.channelMap.get(msgObj.id));

            const {id} = msgObj;
            const channel = this.channelMap.get(id);
            if (channel) {
              channel.handleMessage(msgObj);
            } else {
              this.logger.log(`channel ${id} not found`);
            }

          }
        } catch (e) {
          this.logger.log(e);
        }

      });

      connection.on('close', () => {
        commonChannelPathHandler.disposeConnectionClientId(connection, connectionId as string);

        if (this.heartbeatMap.has(connectionId)) {
          clearTimeout(this.heartbeatMap.get(connectionId) as NodeJS.Timeout);
          this.heartbeatMap.delete(connectionId);

          console.log(`clear heartbeat ${connectionId}`);
        }

        Array.from(this.channelMap.values())
        .filter((channel) => {
           return channel.id.toString().indexOf(connectionId) !== -1;
         })
        .forEach((channel) => {
          channel.close(1, 'close');
          this.channelMap.delete(channel.id);
          console.log(`remove channel ${channel.id}`);
        });

      });
    });
  }
  private channelConnectionSend = (connection: ws) => {
    return (content: string) => {
      if (connection.readyState === connection.OPEN) {
        connection.send(content, (err: any) => {
          if (err) {
            this.logger.log(err);
          }
        });
      }
    };
  }
  public handleUpgrade(wsPathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(wsPathname);

    if (routeResult) {
      const wsServer = this.wsServer;
      wsServer.handleUpgrade(request, socket, head, (connection: any) => {
        connection.routeParam = {
          pathname: wsPathname,
        };

        wsServer.emit('connection', connection);
      });
      return true;
    }

    return false;
  }

}
