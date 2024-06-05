import { GossipsubEvents, gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";
import { PubSub } from "@libp2p/interface";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webRTC } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { Libp2p, createLibp2p } from "libp2p";
import { multiaddr } from "multiaddr";

export interface TopologyNetworkNodeConfig {}

export class TopologyNetworkNode {
  private _config?: TopologyNetworkNodeConfig;
  private _node?: Libp2p;
  private _pubsub?: PubSub<GossipsubEvents>;

  peerId: string = "";

  constructor(config?: TopologyNetworkNodeConfig) {
    this._config = config;
  }

  async start() {
    this._node = await createLibp2p({
      addresses: {
        listen: ["/webrtc"],
      },
      connectionEncryption: [noise()],
      connectionGater: {
        denyDialMultiaddr: () => {
          return false;
        },
      },
      peerDiscovery: [pubsubPeerDiscovery()],
      services: {
        identify: identify(),
        pubsub: gossipsub(),
      },
      streamMuxers: [yamux()],
      transports: [
        webSockets({ filter: filters.all }),
        webRTC(),
        circuitRelayTransport({
          discoverRelays: 1,
        }),
      ],
    });

    await this._node.dial([
      multiaddr(
        "/ip4/127.0.0.1/tcp/50000/ws/p2p/Qma3GsJmB47xYuyahPZPSadh1avvxfyYQwk8R3UnFrQ6aP",
      ),
    ]);

    this._pubsub = this._node.services.pubsub as PubSub<GossipsubEvents>;
    this.peerId = this._node.peerId.toString();

    console.log(
      "topology::network::start: Successfuly started topology network w/ peer_id",
      this.peerId,
    );

    this._pubsub.addEventListener("message", (e) => {
      if (e.detail.topic === "_peer-discovery._p2p._pubsub") return;
      const message = new TextDecoder().decode(e.detail.data);
      console.log(e.detail.topic, message);
    });
  }

  subscribe(topic: string) {
    if (!this._node) {
      console.error(
        "topology::network::subscribe: Node not initialized, please run .start()",
      );
      return;
    }

    try {
      this._pubsub?.subscribe(topic);
      console.log(
        "topology::network::subscribe: Successfuly subscribed the topic",
        topic,
      );
    } catch (e) {
      console.error("topology::network::subscribe:", e);
    }
  }

  unsubscribe(topic: string) {
    if (!this._node) {
      console.error(
        "topology::network::unsubscribe: Node not initialized, please run .start()",
      );
      return;
    }

    try {
      this._pubsub?.unsubscribe(topic);
      console.log(
        "topology::network::unsubscribe: Successfuly unsubscribed the topic",
        topic,
      );
    } catch (e) {
      console.error("topology::network::unsubscribe:", e);
    }
  }

  async sendMessage(topic: string, message: Uint8Array) {
    try {
      await this._pubsub?.publish(topic, message);

      // comment to avoid DoSing browser's console
      console.log(
        "topology::network::sendMessage: Successfuly sent message to topic",
        topic,
      );
    } catch (e) {
      console.error("topology::network::sendMessage:", e);
    }
  }

  pubSubEventListener() {
    return this._pubsub?.addEventListener;
  }
}
