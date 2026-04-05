package com.pardur.dto.response;

import java.util.List;

public class WikiGraphDto {

    public record Node(Integer id, String title, String type) {}
    public record Edge(Integer sourceId, Integer targetId) {}

    private List<Node> nodes;
    private List<Edge> edges;

    public WikiGraphDto(List<Node> nodes, List<Edge> edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    public List<Node> getNodes() { return nodes; }
    public List<Edge> getEdges() { return edges; }
}
