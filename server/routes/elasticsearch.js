export default function (server) {
    const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');

    const searchRoute = {
        method: 'POST',
        handler(req, reply) {
            callWithRequest(req, 'search', {
                index: req.params.index,
                type: req.params.type,
                ...req.query
            }).then(reply);
        }
    };

    server.route({
        path: '/elasticizer/api/_search',
        ...searchRoute
    });

    server.route({
        path: '/elasticizer/api/{index}/_search',
        ...searchRoute
    });

    server.route({
        path: '/elasticizer/api/{index}/{type}/_search',
        ...searchRoute
    });

    server.route({
        path: '/elasticizer/api/_mapping',
        method: 'GET',
        handler(req, reply) {
            callWithRequest(req, 'indices.getMapping').then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/_alias',
        method: 'GET',
        handler(req, reply) {
            callWithRequest(req, 'indices.getAlias').then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/{index}/_alias/{alias}',
        method: 'PUT',
        handler(req, reply) {
            callWithRequest(req, 'indices.putAlias', {
                index: req.params.index,
                name: req.params.alias
            }).then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/{index}/_alias/{alias}',
        method: 'DELETE',
        handler(req, reply) {
            callWithRequest(req, 'indices.deleteAlias', {
                index: req.params.index,
                name: req.params.alias
            }).then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/{index}/{type}',
        method: 'POST',
        handler(req, reply) {
            callWithRequest(req, 'index', {
                index: req.params.index,
                type: req.params.type,
                body: req.payload
            }).then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/{index}/{type}/{id}',
        method: 'POST',
        handler(req, reply) {
            callWithRequest(req, 'index', {
                index: req.params.index,
                type: req.params.type,
                id: req.params.id,
                body: req.payload
            }).then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/{index}/{type}/{id}',
        method: 'GET',
        handler(req, reply) {
            callWithRequest(req, 'get', {
                index: req.params.index,
                type: req.params.type,
                id: req.params.id
            }).then(reply);
        }
    });

    server.route({
        path: '/elasticizer/api/_bulk',
        method: 'POST',
        config: {
            payload: {
                parse: false,
                allow: 'application/x-ldjson'
            }
        },
        handler(req, reply) {
            callWithRequest(req, 'bulk', {
                body: req.payload.toString()
            }).then(reply);
        }
    });

}
