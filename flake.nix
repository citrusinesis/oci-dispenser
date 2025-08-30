{
  description = "Terraform development environment";

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
            # Terraform and related tools
            terraform
            terraform-ls
            terraform-docs
            terragrunt
            tflint

            # Cloud CLIs
            awscli2

            # Utilities
            jq
            yq
            curl
            gnumake

            # Security and validation
            tfsec

            # JSON/YAML processing
            jsonnet

            # Shell utilities
            shellcheck
          ];

          shellHook = ''
            echo "🚀 Terraform development environment loaded!"
            echo ""
            echo "Available tools:"
            echo "  terraform      - Infrastructure as Code tool"
            echo "  terraform-ls   - Language server for Terraform"
            echo "  terraform-docs - Generate documentation from Terraform modules"
            echo "  terragrunt     - Terraform wrapper for DRY configurations"
            echo "  tflint         - Terraform linter"
            echo "  tfsec          - Security scanner for Terraform"
            echo ""
            echo "Cloud CLIs: aws"
            echo "Utilities: jq, yq, curl, make, jsonnet"
            echo "Development: shellcheck"
            echo ""
            echo "Run 'terraform --help' to get started!"
          '';
        };
      }
    );
}
