import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VideoGrid } from "@/components/VideoGrid";

function makePeer(socketId: string, username: string) {
  return {
    socketId,
    username,
    audioOn: true,
    videoOn: true,
    isScreenSharing: false,
  };
}

function renderGrid(peerCount: number) {
  const peers = new Map(
    Array.from({ length: peerCount }, (_, i) => {
      const p = makePeer(`peer-${i}`, `User${i}`);
      return [p.socketId, p];
    })
  );
  const remoteStreams = new Map<string, MediaStream>();

  const { container } = render(
    <VideoGrid
      localStream={null}
      localUsername="Alice"
      remoteStreams={remoteStreams}
      peers={peers}
      isMuted={false}
      isCameraOff={false}
      isScreenSharing={false}
    />
  );
  return container;
}

describe("VideoGrid 佈局", () => {
  it("1 人（只有自己）：沒有 grid，單一 tile 置中", () => {
    const c = renderGrid(0);
    expect(c.querySelector(".grid")).toBeNull();
  });

  it("2 人：grid-cols-2", () => {
    const c = renderGrid(1);
    expect(c.querySelector(".grid")?.className).toContain("grid-cols-2");
  });

  it("3 人：local tile 有 sm:col-span-2", () => {
    const c = renderGrid(2);
    const firstTile = c.querySelector(".grid > *");
    expect(firstTile?.className).toContain("sm:col-span-2");
  });

  it("4 人：grid-cols-2（2x2），local 不 span", () => {
    const c = renderGrid(3);
    expect(c.querySelector(".grid")?.className).toContain("grid-cols-2");
    expect(c.querySelector(".grid > *")?.className ?? "").not.toContain("col-span-2");
  });

  it("5 人：sm:grid-cols-3", () => {
    const c = renderGrid(4);
    expect(c.querySelector(".grid")?.className).toContain("sm:grid-cols-3");
  });

  it("6 人：sm:grid-cols-3", () => {
    const c = renderGrid(5);
    expect(c.querySelector(".grid")?.className).toContain("sm:grid-cols-3");
  });
});
