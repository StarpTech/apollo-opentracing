import { GraphQLResolveInfo, DocumentNode } from "graphql";
import { GraphQLExtension } from "graphql-extensions";
import { Tracer, Span } from "opentracing";
import { Request } from "apollo-server-env";

interface InitOptions {
  server: Tracer;
  local: Tracer;
}

interface RequestStart {
  request: Request;
  queryString?: string;
  parsedQuery?: DocumentNode;
  operationName?: string;
  variables?: { [key: string]: any };
  persistedQueryHit?: boolean;
  persistedQueryRegister?: boolean;
}
interface SpanContext {
  span?: Span;
}
export default class OpentracingExtension<TContext extends SpanContext>
  implements GraphQLExtension<TContext> {
  private serverTracer: Tracer;
  private localTracer: Tracer;
  private requestSpan: Span | null;

  constructor({ server, local }: InitOptions) {
    // TODO: check for server and local to be present and use smarter defaults
    this.serverTracer = server;
    this.localTracer = local;
    this.requestSpan = null;
  }

  requestDidStart(infos: RequestStart) {
    const rootSpan = this.serverTracer.startSpan("request");
    rootSpan.log({
      queryString: infos.queryString
    });
    this.requestSpan = rootSpan;

    return () => {
      rootSpan.finish();
    };
  }

  willResolveField(
    _source: any,
    _args: { [argName: string]: any },
    context: TContext,
    info: GraphQLResolveInfo
  ) {
    const name = info.fieldName || "field";
    const parentSpan = context.span ? context.span : this.requestSpan;

    const span = this.localTracer.startSpan(name, {
      childOf: parentSpan || undefined
    });

    // There is no nicer way to change the span in the context
    context.span = span;

    return (error: Error | null, result: any) => {
      if (error) {
        span.log({ error });
      }
      if (result) {
        span.log({ result });
      }
      span.finish();
    };
  }
}
