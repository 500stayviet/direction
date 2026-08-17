"use client";

/** 흰 카드 위에서 도는 우주 구체 */
export function IntakeAiGlobe() {
  return (
    <div className="intake-ai-orb" aria-hidden>
      <span className="intake-ai-orb-halo" />
      <span className="intake-ai-orb-shadow" />

      <div className="intake-ai-orb-belt intake-ai-orb-belt-a">
        <span className="intake-ai-orb-track" />
        <span className="intake-ai-orb-sat" />
        <span className="intake-ai-orb-sat intake-ai-orb-sat-trail" />
      </div>
      <div className="intake-ai-orb-belt intake-ai-orb-belt-b">
        <span className="intake-ai-orb-track" />
        <span className="intake-ai-orb-sat intake-ai-orb-sat-violet" />
      </div>
      <div className="intake-ai-orb-belt intake-ai-orb-belt-c">
        <span className="intake-ai-orb-sat intake-ai-orb-sat-tiny" />
        <span className="intake-ai-orb-sat intake-ai-orb-sat-tiny intake-ai-orb-sat-tiny-b" />
      </div>

      <div className="intake-ai-orb-sphere">
        <div className="intake-ai-orb-spin">
          <span className="intake-ai-orb-map" />
          <span className="intake-ai-orb-continent" />
          <span className="intake-ai-orb-continent intake-ai-orb-continent-b" />
          <span className="intake-ai-orb-continent intake-ai-orb-continent-c" />
          <span className="intake-ai-orb-lat" />
          <span className="intake-ai-orb-lat intake-ai-orb-lat-b" />
          <span className="intake-ai-orb-lat intake-ai-orb-lat-c" />
          <span className="intake-ai-orb-meridian" />
          <span className="intake-ai-orb-meridian intake-ai-orb-meridian-b" />
          <span className="intake-ai-orb-meridian intake-ai-orb-meridian-c" />
          <span className="intake-ai-orb-meridian intake-ai-orb-meridian-d" />
        </div>
        <span className="intake-ai-orb-shade" />
        <span className="intake-ai-orb-shine" />
        <span className="intake-ai-orb-rim" />
        <span className="intake-ai-orb-atmos" />
      </div>
    </div>
  );
}
