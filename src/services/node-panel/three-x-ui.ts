import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { NodePanelAdapter } from "./adapter";
import type { CreateClientParams, PanelClientStat, PanelInbound } from "./types";

interface ThreeXUIResponse<T> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

interface PanelClient {
  id?: string;
  password?: string;
  auth?: string;
  email?: string;
  totalGB?: number;
  expiryTime?: number;
  enable?: boolean;
  alterId?: number;
  flow?: string;
  method?: string;
  security?: string;
  subId?: string;
}

function parseInboundSettings(raw: string): { clients?: PanelClient[]; method?: string } {
  try {
    return JSON.parse(raw) as { clients?: PanelClient[]; method?: string };
  } catch {
    return {};
  }
}

function firstClientValue(inbound: PanelInbound | null, key: keyof PanelClient): string | undefined {
  const settings = inbound ? parseInboundSettings(inbound.settings) : {};
  return settings.clients?.map((client) => client[key]).find((value): value is string => typeof value === "string" && value.length > 0);
}

export class ThreeXUIAdapter implements NodePanelAdapter {
  private panelUrl: string;
  private username: string;
  private password: string;
  private cookie = "";

  constructor(panelUrl: string, username: string, password: string) {
    this.panelUrl = this.normalizePanelUrl(panelUrl);
    this.username = username;
    this.password = password;
  }

  private normalizePanelUrl(raw: string): string {
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
      const url = new URL(withProtocol);
      let pathname = url.pathname.replace(/\/+$/, "");
      pathname = pathname.replace(/\/panel\/login$/i, "");
      pathname = pathname.replace(/\/panel$/i, "");
      pathname = pathname.replace(/\/login$/i, "");
      return `${url.origin}${pathname}`;
    } catch {
      return raw.replace(/\/+$/, "");
    }
  }

  private parseCookies(headers: Headers): string {
    const headersWithCookie = headers as Headers & { getSetCookie?: () => string[] };
    if (typeof headersWithCookie.getSetCookie === "function") {
      const cookies = headersWithCookie.getSetCookie();
      if (cookies.length > 0) {
        return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
      }
    }

    const setCookie = headers.get("set-cookie");
    if (!setCookie) return "";
    return setCookie.split(";")[0];
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetchWithTimeout(`${this.panelUrl}${path}`, {
      ...options,
      headers: {
        Cookie: this.cookie,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (res.status === 401 || res.status === 307) {
      await this.login();
      return fetchWithTimeout(`${this.panelUrl}${path}`, {
        ...options,
        headers: {
          Cookie: this.cookie,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    }

    return res;
  }

  private async jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await this.request(path, options);
    const raw = await res.text();
    let data: ThreeXUIResponse<T>;
    try {
      data = JSON.parse(raw) as ThreeXUIResponse<T>;
    } catch {
      throw new Error(`3x-ui 接口返回了非 JSON 响应 (HTTP ${res.status})`);
    }

    if (!res.ok) {
      throw new Error(data.msg || `3x-ui API HTTP ${res.status}`);
    }
    if (!data.success) throw new Error(data.msg || `3x-ui 接口返回失败但没有错误消息：${path}`);
    return data.obj as T;
  }

  private async loginAttempt(options: {
    headers: Record<string, string>;
    body: string;
  }): Promise<{ success: boolean; status: number; message: string }> {
    const res = await fetchWithTimeout(`${this.panelUrl}/login`, {
      method: "POST",
      headers: options.headers,
      body: options.body,
      redirect: "manual",
    });

    const cookie = this.parseCookies(res.headers);
    if (cookie) this.cookie = cookie;

    const raw = await res.text();
    let data: { success?: boolean; msg?: string } | null = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (data?.success === true) {
      return { success: true, status: res.status, message: "ok" };
    }

    return { success: false, status: res.status, message: data?.msg || raw || `HTTP ${res.status}` };
  }

  async login(): Promise<boolean> {
    const attempts: Array<{ headers: Record<string, string>; body: string }> = [
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.username, password: this.password }),
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: new URLSearchParams({ username: this.username, password: this.password }).toString(),
      },
    ];

    let lastMessage = "";
    for (const attempt of attempts) {
      const result = await this.loginAttempt(attempt);
      if (result.success) return true;
      lastMessage = result.message;

      if (result.status === 404) {
        throw new Error("登录接口不存在，请检查面板地址。建议填写面板根地址，例如 http://ip:port");
      }
      if (result.status >= 500) {
        throw new Error(`面板服务异常 (HTTP ${result.status})`);
      }
    }

    if (
      lastMessage.toLowerCase().includes("invalid") ||
      lastMessage.includes("密码") ||
      lastMessage.includes("用户名") ||
      lastMessage.toLowerCase().includes("login")
    ) {
      return false;
    }

    throw new Error(`登录失败：${lastMessage || "面板没有返回具体错误内容，请检查地址、账号密码和面板状态"}`);
  }

  async getInbounds(): Promise<PanelInbound[]> {
    return this.jsonRequest<PanelInbound[]>("/panel/api/inbounds/list");
  }

  private async getInbound(inboundId: number): Promise<PanelInbound | null> {
    const inbounds = await this.getInbounds();
    return inbounds.find((item) => item.id === inboundId) ?? null;
  }

  async addClient(params: CreateClientParams): Promise<void> {
    const inbound = await this.getInbound(params.inboundId);
    await this.jsonRequest("/panel/api/inbounds/addClient", {
      method: "POST",
      body: JSON.stringify({
        id: params.inboundId,
        settings: this.buildClientSettings(params, inbound),
      }),
    });
  }

  async deleteClient(inboundId: number, clientCredential: string): Promise<void> {
    const inbound = await this.getInbound(inboundId);
    const client = inbound ? this.findClient(inbound, clientCredential) : null;
    const clientId = client && inbound
      ? this.getClientPrimaryKey(inbound.protocol, client)
      : clientCredential;

    await this.jsonRequest(`/panel/api/inbounds/${inboundId}/delClient/${encodeURIComponent(clientId)}`, {
      method: "POST",
    });
  }

  async updateClientEnable(
    inboundId: number,
    clientCredential: string,
    enable: boolean,
  ): Promise<void> {
    const inbound = await this.getInbound(inboundId);
    if (!inbound) throw new Error(`3x-ui 入站不存在：面板入站 ID ${inboundId} 未找到，请重新同步节点入站`);

    const settings = parseInboundSettings(inbound.settings);
    const client = settings.clients?.find((item) => {
      return item.id === clientCredential
        || item.password === clientCredential
        || item.auth === clientCredential
        || item.email === clientCredential;
    });
    if (!client) throw new Error(`3x-ui 客户端不存在：${clientCredential}，请重新同步流量或重置订阅访问`);

    client.enable = enable;
    await this.jsonRequest(`/panel/api/inbounds/updateClient/${encodeURIComponent(this.getClientPrimaryKey(inbound.protocol, client))}`, {
      method: "POST",
      body: JSON.stringify({ id: inboundId, settings: JSON.stringify(settings) }),
    });
  }

  async updateClient(params: CreateClientParams & { enable?: boolean }): Promise<void> {
    const inbound = await this.getInbound(params.inboundId);
    const clientSettings = JSON.parse(this.buildClientSettings(params, inbound)) as { clients: PanelClient[] };
    if (params.enable === false) {
      clientSettings.clients = clientSettings.clients.map((client) => ({ ...client, enable: false }));
    }

    await this.jsonRequest(`/panel/api/inbounds/updateClient/${encodeURIComponent(this.getParamsPrimaryKey(params))}`, {
      method: "POST",
      body: JSON.stringify({ id: params.inboundId, settings: JSON.stringify(clientSettings) }),
    });
  }

  async getClientTraffic(email: string): Promise<PanelClientStat | null> {
    return this.jsonRequest<PanelClientStat | null>(`/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`);
  }

  async getAllClientTraffics(inboundId: number): Promise<PanelClientStat[]> {
    const inbound = await this.getInbound(inboundId);
    return inbound?.clientStats || [];
  }

  async resetClientTraffic(inboundId: number, email: string): Promise<void> {
    await this.jsonRequest(`/panel/api/inbounds/${inboundId}/resetClientTraffic/${encodeURIComponent(email)}`, {
      method: "POST",
    });
  }

  private findClient(inbound: PanelInbound, credential: string): PanelClient | null {
    const settings = parseInboundSettings(inbound.settings);
    return settings.clients?.find((client) => {
      return client.id === credential
        || client.password === credential
        || client.auth === credential
        || client.email === credential;
    }) ?? null;
  }

  private getClientPrimaryKey(protocol: string, client: PanelClient): string {
    switch (protocol.toLowerCase()) {
      case "trojan":
        return client.password || client.id || client.email || "";
      case "shadowsocks":
        return client.email || client.password || client.id || "";
      case "hysteria":
      case "hysteria2":
        return client.auth || client.email || "";
      default:
        return client.id || client.email || "";
    }
  }

  private getParamsPrimaryKey(params: CreateClientParams): string {
    switch (params.protocol.toLowerCase()) {
      case "shadowsocks":
        return params.email;
      default:
        return params.uuid;
    }
  }

  private buildClientSettings(params: CreateClientParams, inbound: PanelInbound | null): string {
    const totalBytes = (params.totalGB || 0) * 1024 * 1024 * 1024;
    const expiryTime = params.expiryTime || 0;
    const existingClient = inbound ? this.findClient(inbound, params.uuid) ?? this.findClient(inbound, params.email) : null;
    const base = {
      email: params.email,
      totalGB: totalBytes,
      expiryTime,
      enable: true,
      subId: params.subId || existingClient?.subId,
    };

    switch (params.protocol.toLowerCase()) {
      case "vmess":
        return JSON.stringify({ clients: [{ ...base, id: params.uuid, security: existingClient?.security || firstClientValue(inbound, "security") || "auto" }] });
      case "vless":
        return JSON.stringify({ clients: [{ ...base, id: params.uuid, flow: existingClient?.flow || firstClientValue(inbound, "flow") || "" }] });
      case "trojan":
        return JSON.stringify({ clients: [{ ...base, password: params.uuid }] });
      case "shadowsocks":
        return JSON.stringify({ clients: [{ ...base, password: params.uuid, method: existingClient?.method || firstClientValue(inbound, "method") || "" }] });
      case "hysteria":
      case "hysteria2":
        return JSON.stringify({ clients: [{ ...base, auth: params.uuid }] });
      default:
        throw new Error(`3x-ui 客户端配置失败：不支持的协议 ${params.protocol}`);
    }
  }
}
