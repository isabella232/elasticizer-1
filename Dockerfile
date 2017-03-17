FROM kibana:5.2.2
ADD build/elasticizer-2.0.0.zip /
RUN /usr/share/kibana/bin/kibana-plugin install file:///elasticizer-2.0.0.zip
RUN chown -R kibana: /usr/share/kibana