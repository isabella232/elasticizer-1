import {resolve} from 'path';
import elasticsearchRoutes from './server/routes/elasticsearch';

export default function (kibana) {
    return new kibana.Plugin({
        require: ['elasticsearch'],
        uiExports: {
            app: {
                title: 'Elasticizer',
                description: 'For elasticization',
                main: 'plugins/elasticizer/main.js',
                icon: 'plugins/elasticizer/assets/icon.svg'
            }
        },
        config(Joi) {
            return Joi.object({
                enabled: Joi.boolean().default(true),
            }).default();
        },
        init(server, options) {
            elasticsearchRoutes(server);
        }
    });
};
