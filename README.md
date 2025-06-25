# mcp-learning

https://juejin.cn/post/7498256708241031177

![这是图片](https://p3-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/350e15ec847d4399b3257c3f896a7162~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgc3Rhbm55:q75.awebp?rk3s=f64ab15b&x-expires=1751285996&x-signature=1IWkMVK8AYq5agJkz4uq%2F7jDiE8%3D "mcp")

现在我们尝试理解一下：

MCP-client 基于 MCP 协议和 MCP server 建立连接，client 从 server 侧拉取它支持的工具列表；
MCP-client 接收你的问题，传入刚刚从 server 侧拉取的 tools，然后发起大模型调用；
大模型会智能决策是否需要调用工具，如果是就返回工具调用信息，然后发起工具调用请求；
工具的具体执行在 server 侧，可能读取一些本地数据，也可以通过 web APIs 来发起远程请求；
server 侧把工具执行的结果返回给 client
client 拼接工具调用 message（这一步其实就是拼接上下文），然后再次调用大模型拿到回答。