{
  description = "Pulumi OCI Infrastructure with TypeScript";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js and package managers
            nodejs
            yarn

            # Pulumi
            pulumi-bin
            pulumictl

            # OCI CLI for verification
            oci-cli

            # Utilities
            jq
            yq-go
          ];

          shellHook = ''
            echo "🚀 Pulumi TypeScript development environment loaded!"
          '';
        };
      }
    );
}
