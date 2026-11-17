package org.abundent.humkinradio;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pure, read-only native interpretation of the versioned shared skill slices.
 * The game engine owns XP and modules; this class never calculates listening,
 * creates HUM, performs network I/O, claims receipt validity or invokes tools.
 */
final class SkillTreeKernel {
    private SkillTreeKernel() {}

    private static final String CATALOG = "humkin.skill-tree.catalog/v1";
    private static final String SLICE = "humkin.skill-tree.slice/v1";
    private static final String IDENT = "[a-z][a-z0-9._-]{2,100}";
    private static final String FACT = "[a-z][a-z0-9_]{1,64}";

    private static void require(boolean condition, String reason) {
        if (!condition) throw new IllegalArgumentException("SKILL_KERNEL_" + reason);
    }

    private static boolean ident(String value) {
        return value != null && value.matches(IDENT);
    }

    static final class Gate {
        final String fact, admission;
        final int minimum;
        private Gate(String fact, int minimum, String admission) {
            this.fact=fact;
            this.minimum=minimum;
            this.admission=admission;
        }
    }

    static final class Node {
        final String id, parent, title, release, reveal, capability, description;
        final List<Gate> gates;
        Node(JSONObject object) throws JSONException {
            id=object.getString("id");
            parent=object.isNull("parent") ? null : object.getString("parent");
            title=object.getString("title");
            release=object.getString("release");
            reveal=object.getString("reveal");
            capability=object.getString("capability");
            description=object.getString("description");
            require(ident(id) && (parent==null || ident(parent)), "BAD_NODE");
            require(!title.trim().isEmpty() && title.length()<=100
                    && description.length()<=400 && ident(capability), "BAD_METADATA");
            require(("live".equals(release)||"pilot".equals(release)||"planned".equals(release))
                    && ("always".equals(reveal)||"tease".equals(reveal)||"on-parent".equals(reveal)), "BAD_RULES");
            require((parent==null) == "always".equals(reveal), "BAD_ROOT_VISIBILITY");
            JSONArray predicates=object.getJSONArray("requires");
            require(predicates.length()<=8, "BAD_RULES");
            ArrayList<Gate> list=new ArrayList<>();
            for (int i=0;i<predicates.length();i++) {
                JSONObject gate=predicates.getJSONObject(i);
                if (gate.has("fact")) {
                    require(gate.length()==2, "BAD_FACT_GATE");
                    String fact=gate.getString("fact");
                    int min=gate.getInt("gte");
                    require(fact.matches(FACT) && min>=0, "BAD_FACT_GATE");
                    list.add(new Gate(fact,min,null));
                } else if(gate.has("admission")) {
                    require(gate.length()==1, "BAD_ADMISSION_GATE");
                    String admission=gate.getString("admission");
                    require(ident(admission), "BAD_ADMISSION_GATE");
                    list.add(new Gate(null,0,admission));
                } else throw new IllegalArgumentException("SKILL_KERNEL_UNKNOWN_GATE");
            }
            gates=Collections.unmodifiableList(list);
        }
    }

    static final class Tree {
        final String root;
        final Map<String,Node> nodes;
        final Map<String,Integer> depths;
        final List<Node> ordered;

        private Tree(String root, Map<String,Node> all, Map<String,Integer> levels,
                     List<Node> sorted) {
            this.root=root;
            nodes=Collections.unmodifiableMap(new LinkedHashMap<>(all));
            depths=Collections.unmodifiableMap(new HashMap<>(levels));
            ordered=Collections.unmodifiableList(new ArrayList<>(sorted));
        }
    }

    static final class State {
        final String id, title, parent, status, release, capability, description;
        final int depth;
        final List<String> missing;

        private State(Node node, int depth, String status, List<String> missing) {
            id=node.id;
            title=node.title;
            parent=node.parent;
            release=node.release;
            this.depth=depth;
            this.status=status;
            capability="AVAILABLE".equals(status)?node.capability:null;
            description=node.description;
            this.missing=Collections.unmodifiableList(new ArrayList<>(missing));
        }
    }

    static final class Projection {
        final Map<String,State> byId;
        final List<State> visible;
        final List<String> availableCapabilities;
        private Projection(Map<String,State> projected, List<State> shown, List<String> available) {
            byId=Collections.unmodifiableMap(new LinkedHashMap<>(projected));
            visible=Collections.unmodifiableList(new ArrayList<>(shown));
            availableCapabilities=Collections.unmodifiableList(new ArrayList<>(available));
        }
        State get(String id){return byId.get(id);}
    }

    static Tree compile(JSONObject manifest, Map<String,JSONObject> sources) throws JSONException {
        require(CATALOG.equals(manifest.optString("schema"))
                && ident(manifest.optString("root")), "BAD_CATALOG");
        JSONObject bounds=manifest.getJSONObject("limits");
        int maxNodes=bounds.getInt("max_nodes"),maxDepth=bounds.getInt("max_depth");
        JSONArray paths=manifest.getJSONArray("slices");
        require(maxNodes>0 && maxNodes<=256 && maxDepth>0 && maxDepth<=24
                && paths.length()>0 && paths.length()<=32, "BAD_CATALOG");
        Map<String,Node> nodes=new LinkedHashMap<>();
        Map<String,String> owners=new HashMap<>();
        Map<String,String> mounts=new LinkedHashMap<>();
        Set<String> usedPaths=new HashSet<>();

        for (int i=0;i<paths.length();i++) {
            String path=paths.getString(i);
            require(path.matches("slices/[a-z0-9_-]+\\.json")
                    && usedPaths.add(path), "BAD_SLICE_PATH");
            JSONObject slice=sources.get(path);
            require(slice!=null && SLICE.equals(slice.optString("schema")), "BAD_SLICE");
            String id=slice.getString("id");
            String mount=slice.isNull("mount_at")?null:slice.getString("mount_at");
            JSONArray data=slice.getJSONArray("nodes");
            require(ident(id) && (mount==null || ident(mount))
                    && !mounts.containsKey(id) && data.length()>0 && data.length()<=64,
                    "BAD_SLICE");
            mounts.put(id,mount);
            int attached=0;
            for(int j=0;j<data.length();j++) {
                Node node=new Node(data.getJSONObject(j));
                require(!nodes.containsKey(node.id), "DUPLICATE_NODE");
                if ((node.parent==null && mount==null)
                        || (node.parent!=null && node.parent.equals(mount))) attached++;
                nodes.put(node.id,node);
                owners.put(node.id,id);
            }
            require(attached>0, "UNMOUNTED_SLICE");
        }

        String root=manifest.getString("root");
        require(nodes.size()<=maxNodes && nodes.containsKey(root), "BOUNDS_OR_ROOT");
        int roots=0;
        for(Node node:nodes.values())if(node.parent==null)roots++;
        require(roots==1 && nodes.get(root).parent==null, "MULTIPLE_ROOTS");

        for(Node node:nodes.values()) {
            if(node.parent==null) continue;
            require(nodes.containsKey(node.parent), "ORPHAN");
            String owner=owners.get(node.id);
            require(owner.equals(owners.get(node.parent))
                    || node.parent.equals(mounts.get(owner)), "CROSS_SLICE_PARENT");
        }
        for(String mount:mounts.values())if(mount!=null)require(nodes.containsKey(mount), "UNMOUNTED_SLICE");

        Map<String,Integer> depths=new HashMap<>();
        Set<String> visiting=new HashSet<>();
        for (Node node:nodes.values()) depth(node.id,nodes,depths,visiting,maxDepth);
        List<Node> ordered=new ArrayList<>(nodes.values());
        ordered.sort(Comparator.comparingInt((Node n)->depths.get(n.id)).thenComparing(n->n.id));
        return new Tree(root,nodes,depths,ordered);
    }

    private static int depth(String id, Map<String,Node> nodes, Map<String,Integer> saved,
                             Set<String> visiting, int maxDepth) {
        if(saved.containsKey(id))return saved.get(id);
        require(visiting.add(id), "CYCLE");
        Node node=nodes.get(id);
        require(node!=null, "ORPHAN");
        int current=node.parent==null?0:1+depth(node.parent,nodes,saved,visiting,maxDepth);
        require(current<=maxDepth, "MAX_DEPTH");
        visiting.remove(id);
        saved.put(id,current);
        return current;
    }

    /**
     * Admissions must be injected by a verified, owner-local adapter. Supplying
     * an admission string here does not prove a signature or grant authority.
     */
    static Projection project(Tree tree, Map<String,Integer> facts, Set<String> admissions) {
        Map<String,State> byId=new LinkedHashMap<>();
        ArrayList<State> visible=new ArrayList<>();
        ArrayList<String> available=new ArrayList<>();
        for(Node node:tree.ordered){
            State parent=node.parent==null?null:byId.get(node.parent);
            boolean shown=parent==null ||
                    (!"HIDDEN".equals(parent.status) &&
                            ("tease".equals(node.reveal)||"AVAILABLE".equals(parent.status)));
            String status="HIDDEN";
            ArrayList<String> missing=new ArrayList<>();
            if(shown){
                for(Gate gate:node.gates){
                    if(gate.fact!=null) {
                        Integer actual=facts.get(gate.fact);
                        if(actual==null||actual<gate.minimum)missing.add(gate.fact+">="+gate.minimum);
                    } else if(!admissions.contains(gate.admission))missing.add("admit:"+gate.admission);
                }
                boolean parental=parent==null || "AVAILABLE".equals(parent.status);
                boolean lacksFact=false;
                for(String item:missing)if(!item.startsWith("admit:"))lacksFact=true;
                if(!parental||lacksFact)status="LOCKED";
                else if("planned".equals(node.release))status="PLANNED";
                else if("pilot".equals(node.release))status="HELD";
                else if(!missing.isEmpty())status="HELD";
                else status="AVAILABLE";
            }
            State state=new State(node,tree.depths.get(node.id),status,missing);
            byId.put(node.id,state);
            if(shown)visible.add(state);
            if("AVAILABLE".equals(status))available.add(state.capability);
        }
        return new Projection(byId,visible,available);
    }
}
