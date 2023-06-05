/**
 * HTTP status codes.
 */
export enum HttpStatusCodes {
    /**
     * The request succeeded. The result meaning of "success" depends on the HTTP method:
     * - GET: The resource has been fetched and transmitted in the message body.
     * - HEAD: The representation headers are included in the response without any message body.
     * - PUT or POST: The resource describing the result of the action is transmitted in the message body.
     * - TRACE: The message body contains the request message as received by the server.
     */
    OK = 200,

    /**
     * The URL of the requested resource has been changed permanently. The new URL is given in the response.
     */
    MovedPermanently = 301,

    /**
     * This is used for caching purposes. It tells the client that the response has not been modified, so the
     * client can continue to use the same cached version of the response.
     */
    NotModified = 304,

    /**
     * The client does not have access rights to the content; that is, it is unauthorized, so the server is
     * refusing to give the requested resource. Unlike 401 Unauthorized, the client's identity is known to
     * the server.
     */
    Forbidden = 403,

    /**
     * The server cannot find the requested resource. In the browser, this means the URL is not recognized.
     * In an API, this can also mean that the endpoint is valid but the resource itself does not exist.
     * Servers may also send this response instead of 403 Forbidden to hide the existence of a resource from
     * an unauthorized client. This response code is probably the most well known due to its frequent
     * occurrence on the web.
     */
    NotFound = 404,

    /**
     * This response is sent when the requested content has been permanently deleted from server, with no
     * forwarding address. Clients are expected to remove their caches and links to the resource. The HTTP
     * specification intends this status code to be used for "limited-time, promotional services". APIs should
     * not feel compelled to indicate resources that have been deleted with this status code.
     */
    Gone = 410,

    /**
     * The request was well-formed but was unable to be followed due to semantic errors.
     */
    ValidationFailed = 422,

    /**
     * The server has encountered a situation it does not know how to handle.
     */
    InternalServerError = 500,

    /**
     * The server is not ready to handle the request. Common causes are a server that is down for maintenance or
     * that is overloaded. Note that together with this response, a user-friendly page explaining the problem
     * should be sent. This response should be used for temporary conditions and the Retry-After HTTP header
     * should, if possible, contain the estimated time before the recovery of the service. The webmaster must
     * also take care about the caching-related headers that are sent along with this response, as these
     * temporary condition responses should usually not be cached.
     */
    ServiceUnavailable = 503
}
