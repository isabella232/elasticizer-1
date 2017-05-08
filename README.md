# elasticizer

> UI for editing documents in Kibana

![Editing documents](https://preview.ibb.co/bZxk1Q/Screen_Shot_2017_05_08_at_13_53_58.png)
![Editing aliases](https://preview.ibb.co/hNwOo5/Screen_Shot_2017_05_08_at_13_54_12.png)

---

## development

See the [kibana contributing guide](https://github.com/elastic/kibana/blob/master/CONTRIBUTING.md) for instructions setting up your development environment. Once you have completed that, use the following npm tasks.

  - `npm start`

    Start kibana and have it include this plugin

  - `npm start -- --config kibana.yml`

    You can pass any argument that you would normally send to `bin/kibana` by putting them after `--` when running `npm start`

  - `npm run build`

    Build a distributable archive

  - `npm run test:browser`

    Run the browser tests in a real web browser

  - `npm run test:server`

    Run the server tests using mocha

For more information about any of these commands run `npm run ${task} -- --help`.
