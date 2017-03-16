import CodeMirror from 'codemirror';
import 'codemirror/mode/javascript';
import 'elasticsearch-browser/elasticsearch.angular';
import 'jquery-ui/ui/widgets/sortable';
import 'angular-ui-sortable';
import 'angular-ui-codemirror';

import 'ui/autoload/styles';
import './less/main.less';

import './alerts'
import './config'
import './elasticsearch'
import './nav'
import './routes'

window.CodeMirror = CodeMirror;
