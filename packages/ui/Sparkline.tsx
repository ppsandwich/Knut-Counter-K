import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withDelay, withTiming, Easing } from "react-native-reanimated";

function pointsFor(values: number[], width: number, height: number) {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const flatY = height / 2;
  return values.map((value, index) => ({
    x: (index / Math.max(values.length - 1, 1)) * width,
    y: max === min ? flatY : height - ((value - min) / spread) * height
  }));
}

export function Sparkline({ values, color = "#22c55e", animate = true }: { values: number[]; color?: string; animate?: boolean }) {
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
          <SparklineSegment
            key={`${point.x}-${point.y}`}
            color={color}
            left={point.x}
            top={point.y}
            width={length}
            angle={angle}
            index={index}
            totalSegments={points.length - 1}
            animate={animate}
          />
        );
      })}
    </View>
  );
}

function SparklineSegment({ color, left, top, width, angle, index, totalSegments, animate }: {
  color: string;
  left: number;
  top: number;
  width: number;
  angle: string;
  index: number;
  totalSegments: number;
  animate: boolean;
}) {
  const delay = animate ? 500 + (index / totalSegments) * 500 : 0;

  const style = useAnimatedStyle(() => ({
    opacity: withDelay(
      delay,
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) })
    ),
    width: withDelay(
      delay,
      withTiming(width, { duration: 150, easing: Easing.out(Easing.cubic) })
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          backgroundColor: color,
          left,
          top,
          transform: [{ rotate: angle }],
          opacity: animate ? 0 : 1,
          width: animate ? 0 : width,
        },
        style,
      ]}
    />
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
