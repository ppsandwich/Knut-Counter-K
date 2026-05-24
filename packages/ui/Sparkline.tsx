import { StyleSheet, View } from "react-native";

function pointsFor(values: number[], width: number, height: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  return values.map((value, index) => ({
    x: (index / Math.max(values.length - 1, 1)) * width,
    y: height - ((value - min) / spread) * height
  }));
}

export function Sparkline({ values, color = "#22c55e" }: { values: number[]; color?: string }) {
  const width = 82;
  const height = 34;
  const points = pointsFor(values, width, height);

  return (
    <View style={[styles.canvas, { width, height }]}>
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;

        return (
          <View
            key={`${point.x}-${point.y}`}
            style={[
              styles.segment,
              {
                backgroundColor: color,
                left: point.x,
                top: point.y,
                width: length,
                transform: [{ rotate: angle }]
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    overflow: "hidden",
    position: "relative"
  },
  segment: {
    height: 2.4,
    borderRadius: 99,
    position: "absolute",
    transformOrigin: "left center"
  }
});
